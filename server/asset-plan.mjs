import {get,list,put,uid,now} from './store.mjs';
import {searchCatalog,inspectCatalog} from './catalog.mjs';
import {targetFit} from './motion-fit.mjs';
import {planSelectionKey} from './plan-key.mjs';

function candidates(kind,queries,modelId){
 const found=new Map();for(const q of queries||[])for(const item of searchCatalog({kind,q,modelId,limit:12,includeCandidates:true}).items)found.set(item.ref,item);
 return [...found.values()].slice(0,24);
}
export function planAssetRequest(body){
 const previous=body.id?get('plans',body.id):null;if(body.id&&!previous)throw Error('需求记录不存在');
 const request={...previous?.request,...body};delete request.id;
 if(previous&&body.motions&&!body.replaceMotions){const incoming=new Map(body.motions.map(m=>[m.key,m]));request.motions=previous.request.motions.map(m=>({...m,...incoming.get(m.key)}));for(const m of body.motions)if(!request.motions.some(x=>x.key===m.key))request.motions.push(m);}
 if(body.motionSelections){for(const key of Object.keys(body.motionSelections))if(!request.motions?.some(m=>m.key===key))throw Error('动作职责 key 不存在：'+key);request.motions=request.motions.map(m=>Object.hasOwn(body.motionSelections,m.key)?{...m,selectedRef:body.motionSelections[m.key]}:m);}
 delete request.motionSelections;delete request.replaceMotions;
 if(!request.title||!Array.isArray(request.motions)||request.motions.length>30)throw Error('请提供需求名称 title 和 motions 列表（最多 30 项）');
 if(request.motions.some(m=>!m.key)||new Set(request.motions.map(m=>m.key)).size!==request.motions.length)throw Error('每个动作职责需要不重复的 key');
 const plan={id:previous?.id||uid(),request,createdAt:previous?.createdAt||now(),updatedAt:now()};put('plans',plan);return readAssetPlan(plan.id);
}
export function readAssetPlan(id){
 const plan=get('plans',id);if(!plan)throw Error('需求记录不存在');
 const p=plan.request,model=p.modelId?get('assets',p.modelId):null,gaps=[];
 const modelCandidates=model?[]:candidates('model',p.modelQueries||[p.title]);
 if(!model)gaps.push({kind:modelCandidates.length?'choose_model':'missing_model',message:modelCandidates.length?'请用户从候选形象中选择':'未找到符合查询的形象，请扩大检索或准备模型生成方案',next:modelCandidates.length?'inspect':'quote',requiresGenerationApproval:!modelCandidates.length});
 else if(!model.metadata.boneCount)gaps.push({kind:'missing_rig',message:'选定模型没有骨架，先用网站或成熟绑骨工具处理',next:'upload',uiUrl:'/?panel=mixamo&model='+model.id});
 const motions=p.motions.map(m=>{
  const matches=candidates('motion',m.queries||[m.label||m.key],model?.id);let selected=null;
  if(m.selectedRef){try{selected=inspectCatalog({ref:m.selectedRef});if(selected.kind!=='motion')throw Error('不是动作引用');}catch(e){selected=null;gaps.push({kind:'invalid_motion_ref',motionKey:m.key,message:e.message,ref:m.selectedRef,next:'search'});}}
  if(!selected&&m.required!==false)gaps.push({kind:matches.length?'choose_motion':'missing_motion',motionKey:m.key,message:matches.length?'需要比较来源与目标上的实际表现，再选择版本':'动作库中没有查询匹配；可换关键词、使用备选来源或导入外部动作',next:matches.length?'preview':'upload',uiUrl:'/?panel=mixamo'+(model?'&model='+model.id:'')});
  const fit=selected&&model?targetFit(model.id,selected.ref):null;
  return {...m,selected:selected?{ref:selected.ref,assetId:selected.assetId,index:selected.index}:null,candidates:matches,fitStatus:fit?.status||'unreviewed',fit};
 });
 const jobs=list('jobs').filter(j=>j.params?.planId===id).map(j=>({id:j.id,type:j.type,state:j.state,stage:j.stage,outputs:j.outputs,error:j.error}));
 const selectionKey=planSelectionKey(p),actual=list('jobs').filter(j=>j.params?.planId===id&&j.params?.planSelectionKey===selectionKey),latest=actual.find(j=>['compose','frames','generate','import'].includes(j.type)),outputs=actual.flatMap(j=>j.outputs||[]),result=p.resultId?get('assets',p.resultId):null;
 let stage=gaps.length?'needs_selection_or_input':'ready_for_target_preview';
 if(actual.some(j=>['queued','running'].includes(j.state)))stage='processing';else if(latest&&['failed','interrupted'].includes(latest.state))stage='needs_recovery';else if(actual.some(j=>j.state==='needs_input'&&j.type==='mixamo'))stage='waiting_external';else if(!gaps.length&&outputs.length)stage='awaiting_quality_review';
 if(result&&outputs.includes(result.id)&&!gaps.length&&result.quality==='可复用')stage='ready_to_deliver';
 return {...plan,stage,model:model?{ref:'model:'+model.id,assetId:model.id,name:model.name,sha256:model.sha256}:null,modelCandidates,motions,gaps,jobs,outputs,selectedResult:result?{id:result.id,quality:result.quality}:null,delivery:p.delivery||null,nextAdvice:gaps.length?'先处理 gaps；候选存在不代表动作适合玩法。':stage==='processing'?'继续 wait 当前任务。':stage==='needs_recovery'?'读取失败任务的 error 和 nextAction，保留已成功产物。':stage==='awaiting_quality_review'?'先 inspect 已有 outputs，再核对外观/玩法并保存质量判断，不要重复组装。':'调用精确目标试播，核对动作后组装，再生成 handoff。'};
}
export function findPlans(body={}){return {items:list('plans').filter(p=>!body.q||p.request.title.toLowerCase().includes(String(body.q).toLowerCase())).slice(0,Math.min(50,body.limit||20)).map(p=>{const r=readAssetPlan(p.id);return {id:r.id,title:r.request.title,stage:r.stage,updatedAt:r.updatedAt,gaps:r.gaps,outputs:r.outputs,nextAction:{command:'plan-status',arguments:{id:r.id}}};}).filter(p=>!body.stage||p.stage===body.stage)};}
