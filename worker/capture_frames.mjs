import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),base=config.baseUrl;
const runtime=process.env.WORKBENCH_PLAYWRIGHT||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(runtime).href);
let browser,page,items=config.items,outputs=config.outputs||[];
const report=patch=>console.log('WB:'+JSON.stringify(patch));
async function call(route,body){const r=await fetch(base+'/api/'+route,{signal:AbortSignal.timeout(30000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
async function live(){const j=await call('jobs/'+config.jobId);if(j.state==='cancelled')throw Error('任务已取消');}
try{
 browser=await chromium.launch({executablePath:process.env.WORKBENCH_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 page=await browser.newPage({viewport:{width:640,height:640},deviceScaleFactor:1});
 page.on('pageerror',error=>{console.error('Capture page: '+error.message);page.evaluate(message=>{window.captureResult={error:message};},error.message).catch(()=>{});});
 let position=0,lastPercent=-1;
 await page.exposeFunction('reportCaptureProgress',({done,total})=>{const percent=Math.floor(done/total*100);if(percent!==lastPercent){lastPercent=percent;report({stage:`正在捕获第 ${position+1} / ${items.length} 个动作：${done}/${total} 帧`,done:position*100+Math.round(percent*.75),total:items.length*100});}});
 for(position=0;position<items.length;position++){
  const item=items[position];await live();
  if(item.state==='succeeded'&&item.outputIds?.length)continue;
  try{
   item.state='running';delete item.error;report({items,stage:`正在处理第 ${position+1} / ${items.length} 个动作`,done:position*100,total:items.length*100});
   let job=(await call('render-view/lookup',item.spec)).job;
   if(!job){
    lastPercent=-1;await page.goto(base+'/?captureJob='+encodeURIComponent(config.jobId)+'&clip='+item.clipIndex,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.captureResult,undefined,{timeout:180000});
    const result=await page.evaluate(()=>window.captureResult);if(result.error)throw Error(result.error);
    job=await call('jobs/'+result.jobId);
   }
   item.encodeJobId=job.id;item.state='encoding';report({items,stage:`正在整理第 ${position+1} / ${items.length} 个动作的图片`});
   const deadline=Date.now()+180000;
   while(['queued','running'].includes(job.state)){
    if(Date.now()>deadline)throw Error('序列图片编码超时，可重试并复用已捕获图片');
    await new Promise(r=>setTimeout(r,650));await live();job=await call('jobs/'+job.id);
   }
   if(job.state!=='succeeded')throw Error(job.error||job.stage);
   const asset=await call('render-view/'+job.id+'/save',{});item.state='succeeded';item.outputIds=[asset.id];outputs=[...new Set([...outputs,asset.id])];report({items,outputs,done:(position+1)*100,total:items.length*100});
  }catch(e){await live();item.state='failed';item.error=e.message;report({items,outputs});}
 }
 if(items.some(i=>i.state!=='succeeded'))throw Error(outputs.length?'部分动作未完成，已完成的序列帧已入库；重试会继续处理未完成项':'序列帧尚未生成，请查看各片段原因后重试');
}catch(e){console.log('WB_ERROR:'+e.message);process.exitCode=1;}finally{await browser?.close();}
