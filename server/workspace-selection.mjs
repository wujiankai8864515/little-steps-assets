import {inheritWorkspaceDraft} from './workspace-draft.mjs';
import {get,list,put,now,transaction,uid} from './store.mjs';
import {readSpriteSet} from './sprite-sets.mjs';

// Selection is a user's working scope, not a quality verdict. Importing a file,
// completing a job or assigning a public role must never create this record.
export function workspaceSelection(modelId){
 const active=get('workspace-settings','active');
 const id=modelId||active?.modelId,model=id?get('assets',id):null,saved=id?get('workspace-models',id):null;
 const valid=saved&&model?.sha256===saved.sourceHash;
 return {modelId:id||null,selection:valid?saved:null,models:list('workspace-models').filter(s=>!s.archivedAt&&!s.replacedBy&&get('assets',s.id)?.sha256===s.sourceHash).map(s=>{const w=get('workspaces',s.workspaceId);return {id:s.id,workspaceId:s.workspaceId,name:w?.name||get('assets',s.id).name,requiresName:w?.requiresName!==false,modelName:get('assets',s.id).name,clipCount:s.clipIndices.length};}),activeModelId:active?.modelId||null};
}
function selected(body){
 const s=workspaceSelection(body.modelId).selection;
 if(!s||s.archivedAt||s.replacedBy)throw Error('请先在工作台确认选用这个模型');
 const workspace=get('workspaces',s.workspaceId);if(!workspace||workspace.requiresName)throw Error('请先为工作台填写名称');
 if(body.revision!==s.revision)throw Error('工作台选择已改变，请刷新后再操作');
 if(s.pendingJobId){const j=get('jobs',s.pendingJobId);if(j&&!['failed','cancelled','interrupted','needs_input'].includes(j.state))throw Error('上一项动作操作尚未完成，请先等待结果');}
 return s;
}
export function selectWorkspaceModel(body){
 const model=get('assets',body.modelId);
 if(model?.kind!=='model'||!model.metadata.vertices)throw Error('请选择带网格的角色模型');
 if(body.sourceHash!==model.sha256)throw Error('模型版本已改变，请重新预览');
 const old=workspaceSelection(model.id).selection;
 let s=old;
 if(!s||s.archivedAt||s.replacedBy){
  const name=workspaceName(body.name),workspaceId=uid();
  put('workspaces',{id:workspaceId,name,requiresName:false,currentModelId:model.id,createdAt:now(),updatedAt:now()});
  s=put('workspace-models',{id:model.id,sourceHash:model.sha256,clipIndices:old?.clipIndices||[],spriteSetIds:old?.spriteSetIds||[],revision:(old?.revision||0)+1,workspaceId,selectedAt:now(),selectionOrigin:'explicit-named-workspace'});
 }
 put('workspace-settings',{id:'active',modelId:model.id,updatedAt:now()});
 return workspaceSelection(model.id);
}
export function updateWorkspaceSelection(body){
 const s=selected(body),model=get('assets',s.id),patch={};
 if(body.clipIndices!==undefined){
  if(!Array.isArray(body.clipIndices)||body.clipIndices.length>100||body.clipIndices.some(i=>!Number.isInteger(i)||!model.metadata.animations?.[i]||model.metadata.animations[i].reference))throw Error('请选择模型内有效的动作');
  patch.clipIndices=[...new Set(body.clipIndices)];
 }
 const clips=patch.clipIndices||s.clipIndices;
 if(body.spriteSetIds!==undefined){
  if(!Array.isArray(body.spriteSetIds)||body.spriteSetIds.length>30)throw Error('动作集数量无效');
  for(const id of body.spriteSetIds){const set=readSpriteSet(id);if(set.sourceAssetId!==model.id||set.sourceHash!==model.sha256||set.actions.some(a=>!clips.includes(a.clipIndex)))throw Error('动作集必须来自这个模型当前版本的已选动作');}
  patch.spriteSetIds=[...new Set(body.spriteSetIds)];
 }
 put('workspace-models',{...s,...patch,revision:s.revision+1,pendingJobId:null,updatedAt:now()});
 return workspaceSelection(model.id);
}
export function assertWorkspaceClips(body){
 const s=workspaceSelection(body.modelId).selection,clips=body.clips;
 if(!s||!Array.isArray(clips)||!clips.length||clips.some(i=>!s.clipIndices.includes(i)))throw Error('只能制作工作台里已确认选用的动作');
 return s;
}
export function startWorkspaceCompose(body,create){
 const s=selected(body),target=get('assets',s.id),m=body.candidate;
 if(!m)throw Error('先试播一个动作，再确认加入');
 const source=get('assets',m.assetId),clip=source?.metadata.animations?.[m.index],preview=get('previews',m.previewId);
 if(!clip||clip.reference||!preview||preview.state!=='succeeded'||preview.modelId!==target.id||preview.modelHash!==target.sha256||preview.assetId!==source.id||preview.sourceHash!==source.sha256||preview.index!==m.index)throw Error('请先在当前模型上完成这个动作的试播');
 if(source.id===target.id)throw Error('模型自带动作直接确认选用即可');
 const motions=[...s.clipIndices.map(index=>({assetId:target.id,index})),{assetId:source.id,index:m.index,name:m.name}];
 const job=create('compose',{modelId:target.id,motions,keepExisting:false,workspaceSelection:{revision:s.revision+1,sourceHash:s.sourceHash}});
 put('workspace-models',{...s,revision:s.revision+1,pendingJobId:job.id,updatedAt:now()});
 return job;
}
export function finishWorkspaceCompose(body){
 const job=get('jobs',body.jobId),request=job?.params.workspaceSelection;
 if(!request||job.type!=='compose')throw Error('这不是工作台已确认的动作任务');
 const s=workspaceSelection(job.params.modelId).selection;
 if(s?.completedJobId===job.id)return workspaceSelection(job.outputs[0]);
 if(job.state!=='succeeded')throw Error('动作任务尚未完成');
 if(!s||s.pendingJobId!==job.id||s.revision!==request.revision||s.sourceHash!==request.sourceHash)throw Error('原工作台选择已变，结果留在待选素材中，不会覆盖当前选择');
 const output=get('assets',job.outputs[0]);
 if(!output||output.metadata.animations.length!==job.params.motions.length)throw Error('结果动作数量不符，未替换工作台');
 transaction(()=>{
  inheritWorkspaceDraft(s.id,output,job);
  const workspace=get('workspaces',s.workspaceId);if(workspace)put('workspaces',{...workspace,currentModelId:output.id,updatedAt:now()});
  put('workspace-models',{id:output.id,sourceHash:output.sha256,clipIndices:output.metadata.animations.map(c=>c.index),spriteSetIds:[],revision:1,selectedAt:now(),selectionOrigin:'explicit-motion-compose',previousModelId:s.id,workspaceId:s.workspaceId});
  put('workspace-models',{...s,replacedBy:output.id,completedJobId:job.id,pendingJobId:null,updatedAt:now()});
  if(get('workspace-settings','active')?.modelId===s.id)put('workspace-settings',{id:'active',modelId:output.id,updatedAt:now()});
 });
 return workspaceSelection(output.id);
}
export function exportWorkspaceModel(body,create){
 const s=selected(body),model=get('assets',s.id);
 const indices=(model.metadata.animations||[]).map(c=>c.index).filter(i=>!s.clipIndices.includes(i));
 if(!indices.length)return {assetId:model.id,url:'/api/assets/'+model.id+'/download?exact=1'};
 // Export only the chosen clips. The original file and all candidate motions stay intact.
 const key=JSON.stringify([model.sha256,s.clipIndices]);
 const cached=list('jobs').find(j=>j.params.workspaceExportKey===key&&j.params.modelId===model.id&&j.state==='succeeded');
 if(cached)return {assetId:cached.outputs[0],url:'/api/assets/'+cached.outputs[0]+'/download?exact=1'};
 const pending=list('jobs').find(j=>j.params.workspaceExportKey===key&&j.params.modelId===model.id&&['queued','running'].includes(j.state));
 return {job:pending||create('remove-motions',{modelId:model.id,indices,workspaceExportKey:key,keepAsCandidate:true})};
}

function workspaceName(name){if(typeof name!=='string'||!name.trim()||name.trim().length>60)throw Error('请填写 1–60 字的工作台名称');return name.trim();}
export function nameWorkspace(body){
 const s=workspaceSelection(body.modelId).selection;if(!s||s.replacedBy||s.archivedAt)throw Error('这个工作台已不在当前列表');
 const name=workspaceName(body.name),workspaceId=s.workspaceId||uid(),old=get('workspaces',workspaceId);
 put('workspaces',{...old,id:workspaceId,name,requiresName:false,currentModelId:s.id,createdAt:old?.createdAt||now(),updatedAt:now()});
 if(!s.workspaceId)put('workspace-models',{...s,workspaceId});return workspaceSelection(s.id);
}
