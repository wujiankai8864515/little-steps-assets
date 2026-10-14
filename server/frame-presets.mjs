import {get,list,put,now} from './store.mjs';
import {hash,NeedsInput} from './glb.mjs';
import {viewSpec} from './render-view.mjs';
import {DEFAULT_FRAME_VIEW,FRAME_RENDERER_VERSION} from '../shared/render-contract.mjs';

export function saveFramePreset(body){
 const spec=viewSpec(body),id=hash(JSON.stringify([spec.sourceHash,spec.modelId,spec.view,spec.size,spec.fps,FRAME_RENDERER_VERSION]));
 return put('views',{id,modelId:spec.modelId,sourceHash:spec.sourceHash,view:spec.view,size:spec.size,fps:spec.fps,renderer:FRAME_RENDERER_VERSION,name:body.name||'已确认构图',confirmedAt:now()});
}
export function frameRequest(body){
 const model=get('assets',body.modelId);if(!model?.metadata.vertices)throw Error('请选择带网格的模型');
 const clips=[...new Set(body.clips||[body.clipIndex])];if(!clips.length||clips.length>30||clips.some(i=>!Number.isInteger(i)||!model.metadata.animations?.[i]||model.metadata.animations[i].reference))throw Error('请选择 1–30 个已有动作片段');
 let view=body.view,viewOrigin='explicit',preset=null;
 if(!view){
  preset=body.presetId?get('views',body.presetId):list('views').filter(v=>v.modelId===model.id&&v.sourceHash===model.sha256&&v.renderer===FRAME_RENDERER_VERSION).sort((a,b)=>b.confirmedAt.localeCompare(a.confirmedAt))[0];
  if(preset&&(preset.modelId!==model.id||preset.sourceHash!==model.sha256||preset.renderer!==FRAME_RENDERER_VERSION))throw new NeedsInput('构图预设对应其他模型版本，请重新确认构图');
  if(preset){view=preset.view;viewOrigin='confirmedPreset';}
  else if(body.viewMode==='default'){view=DEFAULT_FRAME_VIEW;viewOrigin='default';}
  else throw Object.assign(new NeedsInput('还没有这个模型的已确认构图。请在网页确认构图，或明确使用 viewMode: default 的固定取景。'),{code:'MISSING_VIEW',nextAction:{kind:'human',uiUrl:'/?panel=frames&model='+model.id,instruction:'调整画面后确认构图；只有明确接受默认视图时使用 viewMode: default'}});
 }
 const settings={modelId:model.id,view,size:body.size||preset?.size||512,fps:body.fps||preset?.fps||24,viewOrigin,presetId:preset?.id||null};
 return {...settings,clips,sourceHash:model.sha256,renderer:FRAME_RENDERER_VERSION,specs:clips.map(clipIndex=>viewSpec({...settings,clipIndex})),framingNote:viewOrigin==='default'?'默认固定取景，整段动作是否裁切尚未确认':null};
}
