import fs from 'node:fs';
import {get,list,full} from './store.mjs';
import {hash} from './glb.mjs';
import {frameRequest} from './frame-presets.mjs';
import {reviewRequest,readReview,reviewOptions} from './frame-review.mjs';
import {createSpriteSet,readSpriteSet} from './sprite-sets.mjs';

// The browser and Skill use the same preparation path. Reopening a player reuses
// immutable frame assets and the existing job, including after a page refresh.
export function prepareOnionPreview(body,create){
 const pending=(job,phase)=>({state:'preparing',phase,job,nextAction:{command:'wait',arguments:{id:job.id},after:'成功后用相同参数再次调用 onion-preview；失败时先处理原因，再显式 retry:true。'}});
 const failed=(job,phase)=>({state:'failed',phase,job,error:job.error||job.stage,nextAction:{command:'onion-preview',arguments:{...body,retry:true}}});
 let selections=body.selections;
 if(body.spriteSetId)selections=readSpriteSet(body.spriteSetId).actions.map(a=>({assetId:a.assetId,clipIndex:a.clipIndex}));
 if(body.assetIds){
  if(!Array.isArray(body.assetIds)||!body.assetIds.length)throw Error('没有选中的序列帧');
  const options=reviewOptions();
  selections=body.assetIds.flatMap(id=>{const option=options.find(o=>o.assetId===id);if(!option)throw Error('选中的序列帧不可用，请重新生成');return option.clips.map(c=>({assetId:id,clipIndex:c.index}));});
 }
 if(!selections){
  const request=frameRequest(body),key=hash(JSON.stringify(request.specs.map(s=>s.cacheKey)));
  const assets=list('assets');
  const sources=request.specs.map(s=>assets.find(a=>a.productionKey==='frames:'+s.cacheKey&&fs.existsSync(full(a.file))));
  if(sources.some(a=>!a)){
   const previous=list('jobs').find(j=>j.type==='frames'&&j.params.onionKey===key);
   if(previous&&['queued','running'].includes(previous.state))return pending(previous,'frames');
   if(previous&&previous.state!=='succeeded'&&!body.retry)return failed(previous,'frames');
   const params={modelId:request.modelId,clips:request.clips,view:request.view,size:request.size,fps:request.fps,onionKey:key};
   if(previous&&body.retry)params.resumeFrom=previous.id;
   return pending(create('frames',params),'frames');
  }
  selections=sources.map((a,i)=>({assetId:a.id,clipIndex:request.clips[i]}));
 }
 const request=reviewRequest({selections,intent:'direct',rootMotionPolicy:'preserve'});
 const spriteSet=body.spriteSetId?readSpriteSet(body.spriteSetId):createSpriteSet({selections});
 const identity=values=>JSON.stringify(values.map(a=>[a.assetId,a.sha256,a.clipIndex]));
 const key=hash(identity(request.selections));
 for(const asset of list('assets').filter(a=>a.kind==='review')){
  try{
   const report=JSON.parse(fs.readFileSync(full(asset.file),'utf8'));
   if(identity(report.actions)!==identity(request.selections))continue;
   const result=readReview(asset.id);
   if(!result.evidenceVerified||report.actions.some(a=>a.frames.some(f=>!fs.existsSync(full(asset.file.replace(/[^/\\]+$/,f.file))))))continue;
   return {state:'ready',result,spriteSet,uiUrl:spriteSet.uiUrl,nextAction:{kind:'human',instruction:'打开 uiUrl，同一模型的 2D 动作集自动洋葱播放；可调整顺序，查看锚点和动作衔接。'}};
  }catch{/* An incomplete historical report is not a usable playback cache. */}
 }
 const previous=list('jobs').find(j=>j.type==='review-frames'&&j.params.onionKey===key);
 if(previous&&['queued','running'].includes(previous.state))return pending(previous,'review');
 if(previous&&previous.state!=='succeeded'&&!body.retry)return failed(previous,'review');
 return pending(create('review-frames',{selections,name:'所选动作 · 洋葱播放',intent:'direct',rootMotionPolicy:'preserve',onionKey:key}),'review');
}
