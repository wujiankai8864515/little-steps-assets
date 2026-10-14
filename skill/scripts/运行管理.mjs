import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawn} from 'node:child_process';import {fileURLToPath,pathToFileURL} from 'node:url';import {DatabaseSync} from 'node:sqlite';
const skillRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const configPath=path.join(skillRoot,'references/workbench.json');
export const localCommands=['help','location','doctor','open','stop','bind','pack','restore'];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}};
export function readBinding(){const c=read(configPath);c.dataRoot=path.resolve(c.dataRoot||path.join(c.projectRoot,'data'));c.projectRoot=path.resolve(c.projectRoot);if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(c.baseUrl))throw Error('绑定地址必须是本机 HTTP 服务');return c;}
function identity(c){
 const file=path.join(c.dataRoot,'workbench.sqlite');if(!fs.existsSync(file)||!fs.existsSync(path.join(c.projectRoot,'server/index.mjs')))throw Error('绑定的程序或资产库不存在；不会建立空库');
 const db=new DatabaseSync(file,{readOnly:true});try{const row=db.prepare("SELECT body FROM records WHERE kind='settings' AND id='library'").get();if(!row)throw Error('数据库没有资产库身份');const id=JSON.parse(row.body).libraryId;if(c.libraryId&&c.libraryId!==id)throw Error('资产库 ID 与绑定记录不一致');return id;}finally{db.close();}
}
async function health(c){try{const r=await fetch(c.baseUrl+'/api/health',{signal:AbortSignal.timeout(1500)});if(!r.ok)throw Error('端口响应不是正常的工作台服务');return await r.json();}catch(e){if(e.cause?.code==='ECONNREFUSED'||e.name==='TimeoutError')return null;throw e;}}
function matching(c,h){if(h.name!=='asset-workbench'||h.protocolVersion!==c.protocolVersion||h.libraryId!==c.libraryId||!h.dataRoot||!same(h.dataRoot,c.dataRoot)||!same(h.projectRoot,c.projectRoot))throw Error('端口上的服务与路径绑定不一致；没有停止其他项目进程');}
async function locked(c,fn){
 const file=path.join(c.dataRoot,'service-management.lock'),deadline=Date.now()+20000;let acquired=false;
 while(!acquired){try{fs.writeFileSync(file,JSON.stringify({pid:process.pid}),{flag:'wx'});acquired=true;}catch(e){if(e.code!=='EEXIST')throw e;let old;try{old=read(file);}catch{if(Date.now()>deadline)throw Error('启动锁不完整，请运行 doctor');await pause(100);continue;}if(!alive(old.pid)){fs.unlinkSync(file);continue;}if(Date.now()>deadline)throw Error('另一个 Skill 正在管理服务，请稍后重试');await pause(250);}}
 try{return await fn();}finally{try{if(read(file).pid===process.pid)fs.unlinkSync(file);}catch{}}
}
async function start(c){
 let h=await health(c);if(h){matching(c,h);return h;}
 if(!fs.existsSync(path.join(c.projectRoot,'node_modules/express')))throw Error('程序依赖未安装；请按运行与迁移文档执行 npm ci');
 const leaseFile=path.join(c.dataRoot,'service.json');if(fs.existsSync(leaseFile)&&alive(read(leaseFile).pid))throw Error('旧服务仍在运行但暂未响应；没有创建第二个服务，请运行 doctor');
 const out=fs.openSync(path.join(c.dataRoot,'server.out.log'),'a'),err=fs.openSync(path.join(c.dataRoot,'server.err.log'),'a');
 const env={...process.env,...c.environment,WORKBENCH_DATA_DIR:c.dataRoot,PORT:new URL(c.baseUrl).port};
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:c.projectRoot,env,windowsHide:true,detached:true,stdio:['ignore',out,err]});child.unref();fs.closeSync(out);fs.closeSync(err);
 let spawnError;child.once('error',e=>spawnError=e);const deadline=Date.now()+14000;
 while(!h&&Date.now()<deadline){if(spawnError)throw spawnError;await pause(300);h=await health(c);}
 if(!h)throw Error('服务启动未完成，请查看 '+path.join(c.dataRoot,'server.err.log'));matching(c,h);return h;
}
async function stop(c){
 const h=await health(c);if(!h){const lease=path.join(c.dataRoot,'service.json');if(fs.existsSync(lease)&&alive(read(lease).pid))throw Error('服务未响应但进程仍存活，请先诊断；未按端口强杀');return {stopped:true,wasRunning:false};}matching(c,h);
 const lease=read(path.join(c.dataRoot,'service.json'));if(lease.pid!==h.pid||lease.libraryId!==c.libraryId)throw Error('服务身份文件不一致');
 const r=await fetch(c.baseUrl+'/api/service/shutdown',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:lease.nonce}),signal:AbortSignal.timeout(5000)}),result=await r.json();
 if(r.status===409)return {stopped:false,...result};if(!r.ok)throw Error(result.error||'停止服务失败');
 const deadline=Date.now()+12000;while(alive(lease.pid)&&Date.now()<deadline)await pause(200);if(alive(lease.pid))throw Error('旧服务还没有退出；不会同时启动新进程');return {stopped:true,wasRunning:true,oldPid:lease.pid};
}
export async function ensureService(c){identity(c);return locked(c,()=>start(c));}
function writeBinding(c){const tmp=configPath+'.tmp-'+process.pid;fs.writeFileSync(tmp,JSON.stringify(c,null,2));fs.renameSync(tmp,configPath);}
function python(c){return c.environment?.PYTHON_PATH||process.env.PYTHON_PATH||path.join(os.homedir(),'AppData/Local/Programs/Python/Python311/python.exe');}
async function diagnose(c){
 let database;try{database={ok:true,libraryId:identity(c)};}catch(e){database={ok:false,error:e.message};}let h;try{h=await health(c);}catch(e){h={error:e.message};}
 let pillow=false;if(fs.existsSync(python(c)))pillow=await new Promise(resolve=>{const p=spawn(python(c),['-c','import importlib.util; raise SystemExit(0 if importlib.util.find_spec("PIL") else 1)'],{windowsHide:true,stdio:'ignore'});const timer=setTimeout(()=>{p.kill();resolve(false);},4000);p.once('error',()=>{clearTimeout(timer);resolve(false);});p.once('exit',code=>{clearTimeout(timer);resolve(code===0);});});
 const dependencies={node:process.version,nodeModules:fs.existsSync(path.join(c.projectRoot,'node_modules/express')),dist:fs.existsSync(path.join(c.projectRoot,'dist/index.html')),python:python(c),pillow,blender:c.environment?.BLENDER_PATH||'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe',chrome:c.environment?.WORKBENCH_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',playwright:c.environment?.WORKBENCH_PLAYWRIGHT||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'),luxRuntime:c.environment?.LUX3D_SKILL_ROOT||path.join(os.homedir(),'.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.1/skills/lux3d')};
 const local=database.ok&&dependencies.nodeModules;let identityMatches=false;if(h?.ok)try{matching(c,h);identityMatches=true;}catch{}
 return {phase:identityMatches?'service_bound':'bound_not_running',binding:{...c,skillRoot},database,health:h,identityMatches,dependencies,capabilities:{catalog:local,animationProcessing:local&&fs.existsSync(dependencies.blender),frameCapture:local&&pillow&&dependencies.dist&&fs.existsSync(dependencies.chrome)&&fs.existsSync(dependencies.playwright),onionReview:local&&pillow,luxRuntimePresent:fs.existsSync(dependencies.luxRuntime)&&fs.existsSync(path.join(os.homedir(),'.cache/aholo-lux3d/python-3.11/Scripts/python.exe'))},note:'路径存在仅代表依赖可发现，不证明网站账户、生成额度或游戏质量通过。',nextAction:{command:local?'open':'doctor',instruction:local?'打开页面并按本次所需能力执行':'按运行与迁移.md 安装缺少的依赖后再查看'}};
}
async function transfer(c,request){
 const file=path.join(os.tmpdir(),'asset-workbench-transfer-'+process.pid+'.json');fs.writeFileSync(file,JSON.stringify(request));
 try{return await new Promise((resolve,reject)=>{let out='',err='';const child=spawn(python(c),[path.join(skillRoot,'scripts/迁移资产库.py'),file],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});child.stdout.on('data',s=>out+=s);child.stderr.on('data',s=>err+=s);child.once('error',reject);child.once('close',code=>code===0?resolve(JSON.parse(out)):reject(Error(err.trim()||out.trim()||'迁移处理失败')));});}finally{fs.unlinkSync(file);}
}
export async function manage(cmd,b){
 if(cmd==='help'){
  const c=readBinding();let commandNames=[];const registry=path.join(c.projectRoot,'scripts/command-definitions.mjs');if(fs.existsSync(registry))({commandNames}=await import(pathToFileURL(registry).href));
  return {libraryId:c.libraryId,management:localCommands,commands:commandNames,index:path.join(skillRoot,'references/索引.md'),routes:read(path.join(skillRoot,'references/能力索引.json')),note:'help/location/doctor 不会启动服务；open 在空闲时关闭旧服务再打开。'};
 }
 if(cmd==='location')return {skillRoot,configPath,...readBinding()};
 if(cmd==='bind'){
  const old=readBinding(),c={...old,projectRoot:path.resolve(b.projectRoot||old.projectRoot),dataRoot:path.resolve(b.dataRoot||old.dataRoot),baseUrl:b.baseUrl||old.baseUrl};
  if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(c.baseUrl))throw Error('服务地址无效');if(b.libraryId)c.libraryId=b.libraryId;identity(c);
  if(b.environment){const allowed=['BLENDER_PATH','PYTHON_PATH','WORKBENCH_CHROME','WORKBENCH_PLAYWRIGHT','LUX3D_SKILL_ROOT'];for(const k of Object.keys(b.environment))if(!allowed.includes(k))throw Error('不支持的运行环境字段 '+k);c.environment={...c.environment,...b.environment};}
  if(fs.existsSync(path.join(old.dataRoot,'workbench.sqlite'))){const result=await locked(old,()=>stop(old));if(!result.stopped)throw Error('原库还有任务，先等待完成或明确取消');}
  writeBinding(c);return {phase:'bound',bound:true,configPath,...c,nextAction:{command:'doctor'}};
 }
 const c=readBinding();
 if(cmd==='doctor')return diagnose(c);
 if(cmd==='restore'){
  if(b.destination){b.projectRoot??=path.join(b.destination,'程序');b.dataRoot??=path.join(b.destination,'资产');}if(!b.archive||!b.projectRoot||!b.dataRoot)throw Error('恢复需要 archive 和 destination（或分别指定 projectRoot、dataRoot）');
  const result=await transfer(c,{mode:'restore',archive:path.resolve(b.archive),projectRoot:path.resolve(b.projectRoot),dataRoot:path.resolve(b.dataRoot),skillRoot});
  return {...result,phase:'restored_unbound',nextAction:{command:'bind',arguments:{projectRoot:result.projectRoot,dataRoot:result.dataRoot,libraryId:result.libraryId},instruction:'先在新程序目录 npm ci；同机运行 bind 后 doctor/open。跨机请按包内说明安装 Skill。旧库未删除。'}};
 }
 identity(c);return locked(c,async()=>{
  if(cmd==='stop')return stop(c);
  if(cmd==='open'){const prior=await stop(c);if(!prior.stopped)return {url:c.baseUrl,reused:true,reason:prior.error,active:prior.active};const h=await start(c);return {url:c.baseUrl,restarted:prior.wasRunning,pid:h.pid,libraryId:c.libraryId,note:'服务已就绪；调用者用 Codex 浏览器打开此地址，优先复用已有标签页'};}
  if(cmd==='pack'){
   if(!b.output)throw Error('请指定迁移包 output 的 ZIP 路径');const prior=await stop(c);if(!prior.stopped)throw Error('有活动任务，不能生成一致迁移包；先等待完成或取消');
   try{return await transfer(c,{mode:'pack',output:path.resolve(b.output),projectRoot:c.projectRoot,dataRoot:c.dataRoot,skillRoot,libraryId:c.libraryId,baseUrl:c.baseUrl});}
   finally{if(prior.wasRunning)await start(c);}
  }
  throw Error('未知管理命令');
 });
}
