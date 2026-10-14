import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {ROOT,DATA,library,list,closeStore} from './store.mjs';
export function claimService(port){
 const file=path.join(DATA,'service.json');
 if(fs.existsSync(file)){
  const old=JSON.parse(fs.readFileSync(file,'utf8'));
  let live=false;try{process.kill(old.pid,0);live=true;}catch(e){if(e.code!=='ESRCH')throw Error('无法确认旧服务状态，请先运行 doctor');}
  if(live)throw Error('同一资产库已有服务进程 '+old.pid+'，请通过全局 Skill open 打开');
  fs.unlinkSync(file);
 }
 const lease={pid:process.pid,nonce:crypto.randomUUID(),projectRoot:ROOT,dataRoot:DATA,libraryId:library.libraryId,port,startedAt:new Date().toISOString()};
 fs.writeFileSync(file,JSON.stringify(lease),{flag:'wx'});
 const clean=()=>{try{if(JSON.parse(fs.readFileSync(file,'utf8')).nonce===lease.nonce)fs.unlinkSync(file);}catch{}};
 process.on('exit',clean);return {lease,clean};
}
export function serviceWork(){return [...list('jobs').filter(j=>['queued','running'].includes(j.state)).map(j=>({kind:'job',id:j.id,state:j.state})),...list('previews').filter(j=>['queued','running'].includes(j.state)).map(j=>({kind:'preview',id:j.id,state:j.state}))];}
export function installShutdown(app,server,service,onClose){
 let closing=false;
 app.post('/api/service/shutdown',(req,res)=>{
  if(req.get('origin')||req.body?.nonce!==service.lease.nonce)return res.status(403).json({error:'请使用已绑定的全局 Skill 管理服务'});
  const active=serviceWork();if(active.length)return res.status(409).json({error:'制作任务仍在进行，继续使用当前服务',active});
  if(closing)return res.json({closing:true});closing=true;service.closing=true;res.json({closing:true,pid:process.pid});
  server.close(()=>{onClose?.();closeStore();service.clean();process.exit(0);});server.closeIdleConnections();
 });
}
