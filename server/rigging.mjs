import fs from 'node:fs';
import {get,list,put,full,now,transaction} from './store.mjs';
import {readGlb,hash} from './glb.mjs';
import {workspaceSelection} from './workspace-selection.mjs';
import {readWorkspaceDraft} from './workspace-draft.mjs';
import {modelLibrary} from '../shared/model-library.mjs';

// The binding was made externally. Adoption only links the confirmed result and
// advances the same workspace; it never manufactures weights or selects motions.
export function adoptRiggedModel(body){
 const source=get('assets',body.modelId),result=get('assets',body.riggedId);
 if(!source||!result||source.id===result.id)throw Error('请选择原模型和导回的已绑定角色');
 if(body.sourceHash!==source.sha256||body.riggedHash!==result.sha256)throw Error('模型版本已改变，请重新查看');
 if(result.rigging?.sourceId===source.id)return {modelId:result.id,asset:result,workspace:workspaceSelection(result.id),reused:true};
 if(source.metadata.boneCount)throw Error('原模型已有骨骼；本入口用于给无骨骼模型补充绑定');
 if(!result.riggingReturn||result.handoffModelId!==source.id||result.handoffSourceHash!==source.sha256)throw Error('请从这个模型的“先绑定骨骼”入口导回文件，以保留对应关系');
 if(result.kind!=='model'||!result.metadata.vertices||!result.metadata.boneCount)throw Error('导回文件需要同时带角色网格和骨骼，请重新下载 With Skin 版本');
 if(hash(fs.readFileSync(full(result.file)))!==result.sha256)throw Error('导回文件已被外部修改，请重新导入');
 const {json}=readGlb(full(result.file));
 const meshNodes=(json.nodes||[]).filter(n=>n.mesh!==undefined);
 if(!meshNodes.some(n=>n.skin!==undefined&&json.skins?.[n.skin]?.joints?.length&&json.meshes[n.mesh].primitives.every(p=>p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined)))throw Error('文件中没有绑定到角色网格的蒙皮权重，请完成网站绑骨后再下载');
 if(source.metadata.textures?.length&&!result.metadata.textures?.length)throw Object.assign(Error('导回角色缺少贴图，暂不替换工作台。请使用带贴图的 With Skin 文件，或交给 Codex 恢复原贴图。'),{code:'MISSING_TEXTURES'});
 if(body.confirmAppearance!==true)throw Error('请先在导回预览中确认是同一个角色、外观和贴图完整');
 const family=modelLibrary(list('assets')).find(g=>g.versions.some(a=>a.id===source.id));
 const name=family?.name||source.modelName||source.name,s=get('workspace-models',source.id);
 if(s&&(s.archivedAt||s.replacedBy))throw Error('这个工作台已经切换到其他模型版本，导回文件已保留，请从当前工作台继续');
 if(s?.pendingJobId&&!['failed','cancelled','interrupted','needs_input'].includes(get('jobs',s.pendingJobId)?.state))throw Error('工作台还有未完成操作，请稍后再接回');
 if(s?.clipIndices.length)throw Error('原工作台还有已选动作，请先处理这些动作后再更换绑定版本');
 const output={...result,name:name+' · 已绑定',modelName:name,nameSource:source.nameSource||'inherited',usageRole:'character',modelFamilyId:family?.key||source.id,modelRevisionOf:source.id,parents:[...new Set([source.id,...result.parents])],rigging:{sourceId:source.id,sourceHash:source.sha256,provider:'Mixamo',importJobId:list('jobs').find(j=>j.type==='import'&&j.outputs?.includes(result.id))?.id,appearanceConfirmedAt:now()},processing:{mode:'external-rigging',originalPreserved:true}};
 transaction(()=>{
  put('assets',output);put('assets',{...source,modelReplacedBy:output.id,usageRole:'working'});
  if(s){
   const draft=readWorkspaceDraft(source.id),data={...draft?.data,clip:-1,frameClip:-1,chosen:[],knownClips:[],candidate:null,sourceMode:false,motionPlayback:null,framePlayback:null,picker:true,sourceFilter:'all',mixamoOpen:false,request:null,preparedSetId:null};
   put('workspace-drafts',{id:output.id,sourceHash:output.sha256,schemaVersion:1,revision:1,data,clients:{},inheritedFrom:source.id,updatedAt:now()});
   const layout=get('flow-layouts',source.id);if(layout)put('flow-layouts',{...layout,id:output.id,updatedAt:now()});
   put('workspace-models',{id:output.id,workspaceId:s.workspaceId,sourceHash:output.sha256,clipIndices:[],spriteSetIds:[],revision:1,previousModelId:source.id,selectedAt:now(),selectionOrigin:'explicit-rigging-return'});
   put('workspace-models',{...s,replacedBy:output.id,pendingJobId:null,updatedAt:now()});
   const workspace=get('workspaces',s.workspaceId);if(workspace)put('workspaces',{...workspace,currentModelId:output.id,updatedAt:now()});
   if(get('workspace-settings','active')?.modelId===source.id)put('workspace-settings',{id:'active',modelId:output.id,updatedAt:now()});
  }
 });
 return {modelId:output.id,asset:output,workspace:workspaceSelection(output.id),nextAction:{instruction:'原工作台和模型名称已保留。现在选择动作并在目标角色上试播；导回文件里的动作没有自动选用。',uiUrl:'/?panel=flow&flowModel='+output.id}};
}
