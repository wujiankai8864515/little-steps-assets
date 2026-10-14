import {commandDefinitions} from './command-definitions.mjs';
export const BASE=process.env.ASSET_WORKBENCH_URL||'http://127.0.0.1:4380';
export async function call(method,route,body){
 const r=await fetch((process.env.ASSET_WORKBENCH_URL||BASE)+'/api/'+route,{method,signal:AbortSignal.timeout(30000),headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||String(r.status)),{code:data.code,nextAction:data.nextAction});return data;
}
export async function execute(command,body={}){
 const definition=commandDefinitions[command];if(!definition)throw Error('未知命令');
 const [method,route]=definition,url=typeof route==='function'?route(body):route;
 if(command==='wait'){
  const deadline=Date.now()+Math.min(45000,Math.max(0,Number(body.timeoutMs??15000)));
  while(true){const job=await call('GET',url);if(!['queued','running'].includes(job.state))return job;if(Date.now()>=deadline)return {...job,timedOut:true};await new Promise(r=>setTimeout(r,Math.min(750,deadline-Date.now())));}
 }
 return call(method,url,method==='GET'?undefined:body);
}
