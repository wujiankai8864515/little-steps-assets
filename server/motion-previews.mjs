import fs from 'node:fs';import path from 'node:path';import {Worker} from 'node:worker_threads';
import {DATA,get,list,put,full,rel,now} from './store.mjs';import {hash,NeedsInput} from './glb.mjs';
const VERSION='target-clip-v1-fk-v2',waiters=new Map();let active=null;
function asset(id){const a=get('assets',id);if(!a)throw Error('模型或动作不存在');return a;}
function save(id,patch){const r=get('previews',id);if(!r)return;const next={...r,...patch,updatedAt:now(),events:[...(r.events||[]),...(patch.stage?[{at:now(),stage:patch.stage}]:[])].slice(-12)};put('previews',next);if(!['queued','running'].includes(next.state)){for(const w of waiters.get(id)||[])next.state==='succeeded'?w.resolve(next):w.reject(new NeedsInput(next.error||next.stage));waiters.delete(id);}return next;}
export function previewRecord(id){const r=get('previews',id);if(!r)throw Error('试播记录不存在');return r;}
export function requestMotionPreview(params) {
  const target=asset(params.modelId),source=asset(params.assetId),index=Number(params.index),clip=source.metadata.animations?.[index];
  if(!Number.isInteger(index)||!clip||clip.reference)throw Error('请选择一个有效动作');
  const id=hash(JSON.stringify([VERSION,target.id,target.sha256,source.id,source.sha256,index]));
  const cached=get('previews',id);
  if(cached&&!(params.retry&&['failed','needs_input','interrupted'].includes(cached.state))&&!(cached.state==='succeeded'&&!fs.existsSync(full(cached.file))))return cached;
  const record={id,version:VERSION,modelId:target.id,modelHash:target.sha256,assetId:source.id,sourceHash:source.sha256,index,name:clip.name,state:'queued',stage:'正在准备试播',createdAt:now(),updatedAt:now(),events:[]};
  if(!target.metadata.boneCount){record.state='needs_input';record.stage='这个模型还没有骨架，需要先完成绑定。';record.error=record.stage;record.code='MISSING_RIG';record.nextAction={command:'upload',arguments:{modelId:target.id,unrigged:true,textures:true},uiUrl:'/?panel=mixamo&model='+target.id,instruction:'准备带贴图 FBX → 在 Mixamo 绑定 → 下载 With Skin → import 带 riggingReturn:true → 预览后 rig-adopt。'};}
  put('previews',record);queueMicrotask(pump);return record;
}
export async function awaitMotionPreview(params) {
  const record=requestMotionPreview(params);
  if(record.state==='succeeded')return record;
  if(!['queued','running'].includes(record.state))throw Object.assign(new NeedsInput(record.error||record.stage),{code:record.code,nextAction:record.nextAction});
  return new Promise((resolve,reject)=>{const set=waiters.get(record.id)||[];set.push({resolve,reject});waiters.set(record.id,set);});
}
function pump(){
  if(active)return;
  const record=list('previews').reverse().find(p=>p.state==='queued');if(!record)return;
  let worker;
  try {
    const target=asset(record.modelId),source=asset(record.assetId);
    save(record.id,{state:'running',stage:'正在读取模型'});
    worker=new Worker(new URL('./motion-preview-worker.mjs',import.meta.url),{workerData:{dir:path.join(DATA,'previews','motions',record.id),target:full(target.file),source:full(source.file),index:record.index,name:record.name,targetRig:target.metadata.rigSignature,sourceRig:source.metadata.rigSignature}});
  } catch(e){save(record.id,{state:'failed',stage:'试播准备未完成',error:e.message});queueMicrotask(pump);return;}
  active=worker;let settled=false;
  worker.on('message',message=>{
    if(message.done){settled=true;save(record.id,{state:'succeeded',stage:'可以试播',file:rel(message.file),duration:message.duration,bytes:message.bytes,adaptation:message.adaptation,url:'/api/motion-previews/'+record.id+'/clip'});}
    else if(message.error){settled=true;save(record.id,{state:message.needsInput?'needs_input':'failed',stage:'这个来源暂时无法在目标模型上试播',error:message.error});}
    else if(message.stage)save(record.id,{stage:message.stage});
  });
  worker.on('error',e=>{settled=true;save(record.id,{state:'failed',stage:'试播准备未完成',error:e.message});});
  worker.on('exit',()=>{if(!settled)save(record.id,{state:'interrupted',stage:'试播准备中断，可以重试'});active=null;queueMicrotask(pump);});
}
export function recoverPreviews(){for(const r of list('previews'))if(r.state==='running')save(r.id,{state:'queued',stage:'继续准备试播'});queueMicrotask(pump);}
