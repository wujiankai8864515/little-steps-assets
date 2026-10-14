import fs from 'node:fs';
import {list,get,full,library} from './store.mjs';
import {hash,readGlb} from './glb.mjs';
import {isCharacter} from '../shared/asset-roles.mjs';
import {buildMotionCatalog} from '../shared/motion-catalog.mjs';
import {motionProvenance} from '../shared/motion-provenance.mjs';
import {readReview} from './frame-review.mjs';
import {readSpriteSet} from './sprite-sets.mjs';
import {resolvePick,targetFit} from './motion-fit.mjs';

const assetRef=a=>(a.kind==='model'?'model':a.kind)+':'+a.id;
const base=a=>({assetId:a.id,name:a.name,sha256:a.sha256,usageRole:a.usageRole,source:a.source,description:a.description,tags:a.tags||[],aliases:a.aliases||[],sourceQuality:a.quality,license:a.license,createdAt:a.createdAt,preferredRevision:a.supersededBy||a.modelReplacedBy||null,previewUrl:a.kind==='review'?'/?panel=frames&review='+a.id:'/?panel=library&exact=1&asset='+a.id,downloadUrl:a.kind==='sprite-set'?'/api/sprite-sets/'+a.id+'/download':'/api/assets/'+a.id+'/download?exact=1'});
function sources(a,byId,seen=new Set()){
 if(seen.has(a.id))return [];seen.add(a.id);
 const parents=(a.parents||[]).map(id=>byId.get(id)).filter(Boolean);
 return [{ref:assetRef(a),license:a.license,source:a.source},...parents.flatMap(p=>sources(p,byId,seen))];
}
function selectionContext(assets,jobs){
 const byId=new Map(assets.map(a=>[a.id,a])),origins=motionProvenance(assets,jobs);
 const models=list('workspace-models').filter(s=>!s.archivedAt&&!s.replacedBy&&byId.get(s.id)?.sha256===s.sourceHash),ids=new Set(models.map(s=>s.id)),motions=new Map();
 for(const s of models){
  for(const i of s.clipIndices){const origin=origins.identity(s.id,i),ref='motion:'+origin.assetId+':'+origin.index;motions.set(ref,[...(motions.get(ref)||[]),s.id]);}
  for(const id of s.spriteSetIds||[]){const set=byId.get(id);if(set?.sourceAssetId===s.id&&set.sourceHash===s.sourceHash){try{const value=readSpriteSet(id);if(value.actions.every(a=>s.clipIndices.includes(a.clipIndex))){ids.add(id);for(const parent of set.parents||[])ids.add(parent);}}catch{}}}
 }
 return {models,ids,motions};
}
function build(body={}) {
 const assets=list('assets'),jobs=list('jobs'),byId=new Map(assets.map(a=>[a.id,a])),target=byId.get(body.modelId),origins=motionProvenance(assets,jobs);
 const motions=buildMotionCatalog(assets,jobs,target),items=[],skeletons=new Map(),allPreviews=target?list('previews'):[];
 for(const a of assets){
  if(a.kind==='model')items.push({...base(a),ref:assetRef(a),kind:'model',clipCount:(a.metadata.animations||[]).filter(c=>!c.reference).length,boneCount:a.metadata.boneCount,history:!isCharacter(a)});
  if(['sprites','sprite-set','image','review','handoff'].includes(a.kind))items.push({...base(a),ref:assetRef(a),kind:a.kind,parents:a.parents,sourceAssetId:a.sourceAssetId,clipCount:a.metadata.actionCount,history:!!a.supersededBy});
  if(a.metadata.rigSignature&&a.metadata.boneCount){const ref='skeleton:'+a.metadata.rigSignature,entry=skeletons.get(ref)||{ref,kind:'skeleton',name:a.metadata.boneCount+' 骨骼 · '+a.name,boneCount:a.metadata.boneCount,assetIds:[],quality:'unknown'};entry.assetIds.push(a.id);skeletons.set(ref,entry);}
  for(const t of a.metadata.textures||[])items.push({...base(a),ref:`texture:${a.id}:${t.index}`,kind:'texture',name:t.name,index:t.index,mime:t.mime,history:!!a.supersededBy,downloadUrl:undefined});
 }
 for(const v of motions.variants.values()){
  const identity=origins.identity(v.assetId,v.index),source=byId.get(identity.assetId),ref=`motion:${identity.assetId}:${identity.index}`,previews=target?allPreviews.filter(p=>p.modelId===target.id&&p.assetId===identity.assetId&&p.index===identity.index):[],fit=target?targetFit(target.id,ref):null;
  items.push({...base(source||v.source),ref,kind:'motion',name:v.label,originalName:v.raw,previewUrl:'/?panel=library&asset='+v.assetId+'&clip='+v.index,assetId:identity.assetId,index:identity.index,carrierAssetId:v.assetId,carrierIndex:v.index,sourceName:v.sourceName,category:v.group,duration:v.duration,rigSignature:v.rig,provenanceStatus:identity.provenanceStatus||'recorded',targetPreviewState:previews[0]?.state||'not_requested',targetQuality:fit?.status||'unknown',targetFit:fit,previewRequest:target?{modelId:target.id,ref}:null,sourceHash:source?.sha256,targetHash:target?.sha256,downloadUrl:'/api/assets/'+identity.assetId+'/download?exact=1'});
 }
 items.push(...skeletons.values());
 const selection=selectionContext(assets,jobs);
 for(const item of items){
  const selected=item.kind==='motion'?selection.motions.has(item.ref):item.kind==='skeleton'?item.assetIds.some(id=>selection.ids.has(id)):selection.ids.has(item.assetId);
  item.selectionStatus=selected?'selected':'candidate';item.requiresUserSelection=!selected;
  if(item.kind==='motion')item.selectedForModels=selection.motions.get(item.ref)||[];
 }
 return {items,assets,byId,origins,revision:hash(JSON.stringify({assets,workspace:selection.models,jobs:jobs.filter(j=>j.state==='succeeded'&&['compose','import'].includes(j.type)).map(j=>({id:j.id,params:j.params,outputs:j.outputs}))}))};
}
export function searchCatalog(body={}){
 const {items,revision}=build(body),q=String(body.q||'').trim().toLowerCase(),terms=q.split(/\s+/).filter(Boolean);
 const offset=Math.max(0,Number(body.offset)||0),limit=Math.max(1,Math.min(100,Number(body.limit)||20));
 const filtered=items.filter(item=>{
  if(!body.includeCandidates&&item.selectionStatus!=='selected')return false;
  if(body.kind&&body.kind!=='all'&&item.kind!==body.kind)return false;
  if(body.usageRole&&item.usageRole!==body.usageRole)return false;
  if(!body.includeHistory&&item.history&&!body.usageRole&&item.selectionStatus!=='selected')return false;
  return terms.every(term=>[item.name,item.originalName,item.sourceName,item.source,item.category,item.ref,item.description,...(item.tags||[]),...(item.aliases||[])].filter(Boolean).join(' ').toLowerCase().includes(term));
 });
 return {schemaVersion:2,libraryId:library.libraryId,revision,total:filtered.length,offset,limit,scope:body.includeCandidates?'selected-and-candidates':'selected',selectionNote:'已选用不代表质量通过；其他模型选过的动作仍需在本次目标上试播。候选不足时显式 includeCandidates:true 检索待选素材，不能自动加入工作台。',items:filtered.slice(offset,offset+limit)};
}
export function inspectCatalog(body={}){
 const ref=body.ref||body.id;if(!ref)throw Error('请提供资产 ref 或 id');
 const [kind,id,indexText]=ref.includes(':')?ref.split(':'):['asset',ref],a=get('assets',id),index=Number(indexText);
 if(kind==='skeleton'){
  const assets=list('assets').filter(a=>a.metadata.rigSignature===id&&a.metadata.boneCount);
  if(!assets.length)throw Error('骨架不存在');return {libraryId:library.libraryId,ref,bones:assets[0].metadata.bones,assets:assets.map(base),quality:'unknown'};
 }
 if(!a)throw Error('指定的精确资产不存在');
 if(a.kind==='review')return {libraryId:library.libraryId,...readReview(a.id)};
 if(a.kind==='sprite-set')return {libraryId:library.libraryId,...base(a),kind:a.kind,...readSpriteSet(a.id)};
 if(kind==='motion'&&(!Number.isInteger(index)||!a.metadata.animations?.[index]))throw Error('动作引用不存在');
 const byId=new Map(list('assets').map(a=>[a.id,a])),origins=motionProvenance([...byId.values()],list('jobs'));
 const selection=selectionContext([...byId.values()],list('jobs')),identity=kind==='motion'?origins.identity(a.id,index):null,selected=kind==='motion'?selection.motions.has('motion:'+identity.assetId+':'+identity.index):selection.ids.has(a.id);
 const result={libraryId:library.libraryId,ref:kind==='asset'?assetRef(a):ref,...base(a),selectionStatus:selected?'selected':'candidate',requiresUserSelection:!selected,kind:kind==='asset'?a.kind:kind,file:full(a.file),exists:fs.existsSync(full(a.file)),parents:a.parents,modelRevisionOf:a.modelRevisionOf,modelFamilyId:a.modelFamilyId,licenseSources:sources(a,byId)};
 if(kind==='texture'){
  const im=readGlb(full(a.file)).json.images?.[index];if(!im)throw Error('贴图引用不存在');
  return {...result,texture:a.metadata.textures[index],storage:im.bufferView===undefined?'external':'embedded',downloadUrl:im.bufferView===undefined?null:`/api/assets/${a.id}/texture/${index}`};
 }
 if(kind==='motion')return {...result,index,clip:a.metadata.animations[index],identity:origins.identity(a.id,index),targetQuality:body.modelId?targetFit(body.modelId,ref)?.status||'unknown':'unknown',targetFit:body.modelId?targetFit(body.modelId,ref):null};
 return {...result,metadata:a.metadata,animations:(a.metadata.animations||[]).map(c=>({...c,ref:`motion:${a.id}:${c.index}`,origin:origins.identity(a.id,c.index)})),skeletonRef:a.metadata.boneCount?'skeleton:'+a.metadata.rigSignature:null,textureRefs:(a.metadata.textures||[]).map(t=>`texture:${a.id}:${t.index}`),package:a.package,processing:a.processing,framingPresets:list('views').filter(v=>v.modelId===a.id&&v.sourceHash===a.sha256),previewGif:a.previewGif?'/files/'+a.previewGif:null};
}
export const resolveMotionPick=resolvePick;
