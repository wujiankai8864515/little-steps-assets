import {readWorkspaceDraft} from './workspace-draft.mjs';
import {get,list,put,now,library} from './store.mjs';
import {hash} from './glb.mjs';
import {isCharacter} from '../shared/asset-roles.mjs';
import {motionProvenance} from '../shared/motion-provenance.mjs';
import {readSpriteSet} from './sprite-sets.mjs';
import {workspaceSelection} from './workspace-selection.mjs';

export function assetFlow(body={}){
 const assets=list('assets'),jobs=list('jobs'),byId=new Map(assets.map(a=>[a.id,a]));
 const workspace=workspaceSelection(body.modelId),selection=workspace.selection&&!workspace.selection.archivedAt&&!workspace.selection.replacedBy?workspace.selection:null;
 const sets=assets.filter(a=>a.kind==='sprite-set'&&!a.supersededBy);
 const models=workspace.models,selected=byId.get(workspace.modelId);
 const candidateModels=assets.filter(a=>isCharacter(a)&&!models.some(m=>m.id===a.id)).map(a=>({id:a.id,name:a.name}));
 if(!selected)return {libraryId:library.libraryId,models,candidateModels,selection:null,motions:[],candidateMotions:[],spriteSets:[],candidateSets:[],ancestry:[],nodes:[],edges:[],modelId:null};
 if(selected.kind!=='model')throw Error('请选择 3D 模型作为流程起点');
 const origins=motionProvenance(assets,jobs),allMotions=(selected.metadata.animations||[]).filter(a=>!a.reference).map(a=>{
  const origin=origins.identity(selected.id,a.index),source=byId.get(origin.assetId);
  return {index:a.index,name:a.name,duration:a.duration,ref:`motion:${selected.id}:${a.index}`,sourceRef:`motion:${origin.assetId}:${origin.index}`,sourceName:source?.name||'来源未记录',source:source?.source||'来源未记录',sourceHash:source?.sha256,provenanceStatus:origin.provenanceStatus||'recorded'};
 });
 const parentModel=a=>{const production=jobs.find(j=>j.outputs?.includes(a.id)&&j.params.modelId);return byId.get(a.modelRevisionOf||production?.params.modelId)||(a.parents||[]).map(id=>byId.get(id)).find(p=>p?.kind==='model'&&p.usageRole!=='motion-source');};
 const ancestry=[],seen=new Set([selected.id]);let cursor=parentModel(selected);
 while(cursor&&!seen.has(cursor.id)){seen.add(cursor.id);ancestry.unshift({id:cursor.id,ref:'model:'+cursor.id,name:cursor.name,source:cursor.source,sha256:cursor.sha256});cursor=parentModel(cursor);}
 const previousSpriteSets=[];const savedIds=new Set();
 for(const ancestor of [...ancestry].reverse())for(const id of [...(get('workspace-models',ancestor.id)?.spriteSetIds||[]),get('workspace-renders',ancestor.id)?.spriteSetId].filter(Boolean)){if(savedIds.has(id))continue;try{const set=readSpriteSet(id);previousSpriteSets.push({...set,sourceModelName:ancestor.name});savedIds.add(id);}catch{}}
 let previewModel=selected;const visualSeen=new Set();
 while(previewModel.processing?.geometryPreserved&&previewModel.modelRevisionOf&&!visualSeen.has(previewModel.id)){visualSeen.add(previewModel.id);const parent=byId.get(previewModel.modelRevisionOf);if(!parent)break;previewModel=parent;}
 const previousJob=jobs.find(j=>j.type==='compose'&&j.outputs?.includes(selected.id)&&j.params.workspaceSelection);
 const clipMapFromPrevious=previousJob?Object.fromEntries(previousJob.params.motions.map((m,i)=>m.assetId===previousJob.params.modelId?[m.index,i]:null).filter(Boolean)):{};
 const motions=allMotions.filter(m=>selection?.clipIndices.includes(m.index));
 const availableSets=sets.filter(s=>s.sourceAssetId===selected.id&&s.sourceHash===selected.sha256).map(s=>readSpriteSet(s.id));
 const spriteSets=availableSets.filter(s=>selection?.spriteSetIds.includes(s.id)&&s.actions.every(a=>selection.clipIndices.includes(a.clipIndex)));
 const pending=jobs.filter(j=>j.params.modelId===selected.id&&['frames','compose','remove-motions','mixamo'].includes(j.type)&&!['succeeded','cancelled'].includes(j.state)).map(j=>({id:j.id,type:j.type,state:j.state,stage:j.stage,done:j.done,total:j.total,outputs:j.outputs}));
 const nodes=[{id:'model:'+selected.id,kind:'model',assetId:selected.id,name:selected.name,source:selected.source,sha256:selected.sha256,quality:selected.quality,thumbnail:selected.thumbnail,ancestry},...motions.map(m=>({id:m.ref,kind:'motion',...m})),...spriteSets.map(s=>({id:s.ref,kind:'sprite-set',assetId:s.id,name:s.name,sha256:s.sha256,sourceHash:s.sourceHash,actions:s.actions,playback:s.playback,uiUrl:s.uiUrl}))];
 const edges=motions.map(m=>({from:'model:'+selected.id,to:m.ref,relation:'包含动作'}));
 for(const s of spriteSets)for(const a of s.actions)edges.push({from:`motion:${selected.id}:${a.clipIndex}`,to:s.ref,relation:'渲染为序列帧',frameAssetId:a.assetId,frameSha256:a.sha256,sourceHash:s.sourceHash,camera:s.camera,pivot:s.pivot});
 return {schemaVersion:2,libraryId:library.libraryId,modelId:selected.id,model:{id:selected.id,name:selected.name,file:selected.file,thumbnail:selected.thumbnail,sha256:selected.sha256,quality:selected.quality,source:selected.source,license:selected.license,boneCount:selected.metadata.boneCount,rigState:selected.metadata.boneCount?'present':'missing',riggingUrl:'/?panel=mixamo&model='+selected.id},models,candidateModels,selection,draft:readWorkspaceDraft(selected.id),previewModelId:previewModel.id,clipMapFromPrevious,previousSpriteSets,renderSession:get('workspace-renders',selected.id),ancestry,motions,candidateMotions:allMotions.filter(m=>!selection?.clipIndices.includes(m.index)),spriteSets,candidateSets:availableSets.filter(s=>!spriteSets.some(v=>v.id===s.id)),pending,nodes,edges,layout:get('flow-layouts',selected.id),revision:hash(JSON.stringify({nodes,edges,pending,selection})),uiUrl:'/?panel=flow&flowModel='+selected.id,nextAction:{instruction:selection?'工作台只包含明确选用的模型与动作。预览和添加动作在节点内完成；目录中的其他素材都是待选，任务成功不等于用户审核通过。':'这个模型仅供查看。用户确认选用后再添加动作；模型自带动作不会自动加入。'}};
}

export function saveFlowLayout(body){
 const model=get('assets',body.modelId);if(model?.kind!=='model')throw Error('流程模型不存在');
 const positions=body.positions;if(!positions||Array.isArray(positions)||Object.keys(positions).length>100)throw Error('布局节点数量无效');
 for(const [id,p] of Object.entries(positions))if(id.length>150||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>100000||Math.abs(p.y)>100000)throw Error('布局坐标无效');
 return put('flow-layouts',{id:model.id,version:3,positions,updatedAt:now()});
}
