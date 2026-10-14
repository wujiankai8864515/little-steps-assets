import fs from 'node:fs';
import path from 'node:path';
import {DATA,get,list,put,uid,now,full,rel,saveJson,transaction,library} from './store.mjs';
import {hash} from './glb.mjs';
import {reviewRequest} from './frame-review.mjs';

export function createSpriteSet(body){
 const {selections}=reviewRequest(body),first=selections[0].manifest;
 const context=m=>JSON.stringify([m.sourceAssetId,m.sourceHash,m.camera,m.renderer,m.size,m.fps,m.pivot]);
 if(!first.sourceAssetId||!first.sourceHash||!first.camera||!first.renderer||!first.pivot)throw Error('这组旧图片缺少模型或构图记录，请用同一模型和构图重新生成');
 if(selections.some(s=>context(s.manifest)!==context(first)))throw Error('一套 2D 资产需要同一个模型版本、构图、尺寸、帧率和锚点');
 const keys=new Set();
 const members=selections.filter(s=>{const key=s.assetId+':'+s.clipIndex;if(keys.has(key))return false;keys.add(key);return true;});
 const productionKey='sprite-set:'+hash(JSON.stringify(members.map(s=>[s.assetId,s.sha256,s.clipIndex]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))));
 const old=list('assets').find(a=>a.productionKey===productionKey&&fs.existsSync(full(a.file)));
 if(old)return readSpriteSet(old.id);
 const id=uid(),folder=path.join(DATA,'assets',id),source=get('assets',first.sourceAssetId);
 const actions=members.map(s=>({key:s.assetId+':'+s.clipIndex,assetId:s.assetId,sha256:s.sha256,clipIndex:s.clipIndex,name:s.clip.name,frames:s.clip.frames.length,fps:s.manifest.fps,file:get('assets',s.assetId).file,renderManifest:get('assets',s.assetId).renderManifest}));
 const manifest={schemaVersion:1,libraryId:library.libraryId,sourceAssetId:first.sourceAssetId,sourceHash:first.sourceHash,camera:first.camera,renderer:first.renderer,size:first.size,fps:first.fps,pivot:first.pivot,rootMotion:first.rootMotion||'unknown',actions,defaultOrder:actions.map(a=>a.key),createdAt:now(),pathNote:'file 和 renderManifest 均相对于绑定的数据目录；迁移后按 libraryId 与资产 ID 查找，不依赖旧盘符。'};
 fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,'sprite-set.json');saveJson(file,manifest);
 const asset={id,kind:'sprite-set',name:body.name||`${source?.name.split(' · ')[0]||'角色'} · 2D 动作集 · ${actions.length} 个动作`,file:rel(file),sha256:hash(fs.readFileSync(file)),metadata:{actionCount:actions.length},productionKey,usageRole:'sprite-set',parents:members.map(s=>s.assetId),sourceAssetId:first.sourceAssetId,sourceHash:first.sourceHash,contextKey:hash(context(first)),thumbnail:get('assets',members[0].assetId)?.thumbnail,previewGif:get('assets',members[0].assetId)?.previewGif,quality:'待查看',source:'同模型序列帧动作集',license:'继承模型与各动作来源许可',createdAt:now()};
 transaction(()=>{put('assets',asset);for(const a of list('assets').filter(a=>a.kind==='sprite-set'&&!a.supersededBy&&a.id!==id&&a.contextKey===asset.contextKey)){try{const m=JSON.parse(fs.readFileSync(full(a.file),'utf8'));if(m.actions.every(v=>keys.has(v.key)))put('assets',{...a,supersededBy:id});}catch{}}});
 return readSpriteSet(id);
}

export function readSpriteSet(id){
 const asset=get('assets',id);if(asset?.kind!=='sprite-set')throw Error('2D 动作集不存在');
 const content=fs.readFileSync(full(asset.file));if(hash(content)!==asset.sha256)throw Error('动作集清单被外部修改，请重新归组');
 const manifest=JSON.parse(content),playback=get('sprite-playlists',id)||{id,order:manifest.defaultOrder,repeat:true,updatedAt:asset.createdAt};
 return {id,ref:'sprite-set:'+id,name:asset.name,sha256:asset.sha256,file:full(asset.file),exists:true,...manifest,playback,actions:manifest.actions.map(a=>({...a,absoluteFile:full(a.file),manifestFile:full(a.renderManifest),exists:fs.existsSync(full(a.file))&&fs.existsSync(full(a.renderManifest)),downloadUrl:'/api/assets/'+a.assetId+'/download?exact=1'})),manifestUrl:'/api/sprite-sets/'+id+'/manifest',downloadUrl:'/api/sprite-sets/'+id+'/download',uiUrl:'/?panel=frames&spriteSet='+id};
}

export function saveSpritePlayback(id,body){
 const set=readSpriteSet(id),keys=new Set(set.actions.map(a=>a.key));
 if(!Array.isArray(body.order)||!body.order.length||body.order.length>30||body.order.some(k=>!keys.has(k)))throw Error('请选择本动作集中的 1–30 段动作；允许重复播放同一动作');
 const playback=put('sprite-playlists',{id,order:body.order,repeat:body.repeat!==false,updatedAt:now()});
 return {spriteSetId:id,playback,note:'只保存验收播放顺序，不改动模型、原帧或根运动。'};
}
