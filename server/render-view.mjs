import fs from 'node:fs';import path from 'node:path';
import {PerspectiveCamera,Vector3} from 'three';
import {DATA,get,list,saveJson} from './store.mjs';import {hash} from './glb.mjs';
import {FRAME_RENDERER_VERSION} from '../shared/render-contract.mjs';
export function viewSpec(body){
  const model=get('assets',body.modelId);if(!model?.metadata.vertices)throw Error('请选择有网格的模型');
  const clipIndex=Number(body.clipIndex),clip=model.metadata.animations?.[clipIndex];if(!Number.isInteger(clipIndex)||!clip||clip.reference)throw Error('请选择已有动作');
  const size=Number(body.size||512),fps=Number(body.fps||24);if(![256,512,1024].includes(size)||![12,24,30].includes(fps))throw Error('图片大小或帧率不支持');
  const count=Math.max(1,Math.ceil(clip.duration*fps-1e-4));if(count>720)throw Error('本段动作超过 720 帧，请降低帧率或选择更短的片段');
  const vector=(v)=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<10000);
  if(!vector(body.view?.position)||!vector(body.view?.target)||!Number.isFinite(body.view?.fov)||body.view.fov<10||body.view.fov>120)throw Error('请先在预览中调整好画面');
  const view={position:body.view.position,target:body.view.target,fov:body.view.fov};
  if(new Vector3(...view.position).distanceTo(new Vector3(...view.target))<.01)throw Error('相机位置无效');
  const params={modelId:model.id,sourceHash:model.sha256,clipIndex,size,fps,view,frameCount:count,renderer:FRAME_RENDERER_VERSION};
  return {...params,cacheKey:hash(JSON.stringify(params)),viewOrigin:['default','explicit','confirmedPreset'].includes(body.viewOrigin)?body.viewOrigin:'explicit',presetId:body.presetId||null};
}
export function completeView(key){const folder=viewFolder(key);return ['preview.gif','preview.png','sprites.zip','frames.json'].every(file=>fs.existsSync(path.join(folder,file))&&fs.statSync(path.join(folder,file)).size>0);}
export function cachedView(spec){return list('jobs').find(j=>j.type==='render-view'&&j.params.cacheKey===spec.cacheKey&&(['queued','running'].includes(j.state)||(j.state==='succeeded'&&completeView(spec.cacheKey))))||null;}
export function viewFolder(key){if(!/^[a-f0-9]{64}$/.test(key))throw Error('预览标识无效');return path.join(DATA,'previews','frames',key);}
export function storeViewFrames(spec,files){
  if(files.length!==spec.frameCount)throw Error('收到的图片数量不完整，请重新生成预览');
  if(files.reduce((n,f)=>n+f.buffer.length,0)>256*1024*1024)throw Error('这组图片超过 256MB，请降低图片大小');
  for(const f of files){const b=f.buffer;if(b.length<24||!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b.readUInt32BE(16)!==spec.size||b.readUInt32BE(20)!==spec.size)throw Error('图片格式或尺寸不一致');}
  const folder=viewFolder(spec.cacheKey),clip=get('assets',spec.modelId).metadata.animations[spec.clipIndex];fs.mkdirSync(path.join(folder,'clip_00'),{recursive:true});
  const frames=files.map((f,i)=>{const file='clip_00/'+String(i).padStart(4,'0')+'.png';fs.writeFileSync(path.join(folder,file),f.buffer);return {file,time:i/spec.fps};});
  const camera=new PerspectiveCamera(spec.view.fov,1,.01,80);camera.position.fromArray(spec.view.position);camera.lookAt(new Vector3(...spec.view.target));camera.updateMatrixWorld(true);const origin=new Vector3(0,0,0).project(camera);
  saveJson(path.join(folder,'frames.json'),{fps:spec.fps,size:spec.size,loop:false,previewLoops:true,rootMotion:'preserved',renderer:spec.renderer,camera:spec.view,viewOrigin:spec.viewOrigin,presetId:spec.presetId,sourceAssetId:spec.modelId,sourceHash:spec.sourceHash,pivot:[(origin.x+1)/2,(1-origin.y)/2],clips:[{name:clip.name,index:spec.clipIndex,duration:clip.duration,frames}]});
}
