import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ReactFlow,Background,Controls,Handle,Position,MarkerType,useNodesState} from '@xyflow/react';
import {Box,Activity,Film,Play,Plus,X,Search,Download,Check,GitBranch,LoaderCircle} from 'lucide-react';
import {SelectField,ProgressBar} from './components/ui.jsx';
import FrameReviewDrawer from './FrameReviewDrawer.jsx';
import MixamoDrawer from './MixamoDrawer.jsx';
import Viewer from './Viewer.jsx';
import {createWorkspaceMemory} from './workspace-memory.js';
import {motionName} from './motion-labels.js';
import {buildMotionCatalog} from '../shared/motion-catalog.mjs';
import '@xyflow/react/dist/style.css';
import './asset-flow.css';

const running=j=>['queued','running'].includes(j?.state);
function ModelNode({data:d}){
 return <section className="flow-card flow-model">
  <header><Box size={17}/><strong>01 · 模型</strong></header>
  <div className="flow-static-view nodrag nowheel nopan"><Viewer key={d.workspaceKey} asset={d.geometryAsset||d.asset} clipIndex={-1} allowedClipIndices={[]} embedded frameMode staticPreview hidePlayback hideToolbar initialView={d.modelView||{position:[0,1.15,4.8],target:[0,1,0],fov:33}} onViewChange={d.modelViewChanged} onReady={d.baseReady}/></div>
  <div className="flow-model-caption"><strong>{d.asset?.name||'选择一个模型开始'}</strong><span>原始静止外观 · 拖动可旋转查看</span></div>
  <Handle type="source" position={Position.Right} id="model-out"/>
 </section>;
}
function MotionsNode({data:d}){
 const needsRig=!d.model?.metadata.boneCount;
 return <section className={'flow-card flow-motions'+(needsRig?' flow-awaiting-rig':'')}>
  <Handle type="target" position={Position.Left} id="in"/>
  <header><Activity size={17}/><strong>02 · 已选动作</strong><small>{d.motions.length} 个</small></header>
  <div className="flow-motion-view flow-clip-view nodrag nowheel nopan"><Viewer key={d.workspaceKey} asset={d.displayAsset} geometryAsset={d.sourceMode?d.displayAsset:d.geometryAsset} initialView={d.motionView} onViewChange={d.motionViewChanged} initialPlayback={d.motionPlayback} onPlaybackChange={d.motionPlaybackChanged} clipIndex={d.displayClip} allowedClipIndices={d.allowed} embedded frameMode hideToolbar showClipSelector={false} animationPreview={d.animationPreview} playSignal={d.motionPlaySignal} onReady={d.ready} onPreviewReady={d.previewReady}/></div>
  <p className="flow-preview-caption">{needsRig?'先绑定骨骼，再给这个角色添加动作':d.sourceMode?'动作来源演示 · 点候选旁的 ▶ 回到目标效果':d.candidate?'候选试播 · '+d.candidate.label:'点动作旁的 ▶，在这里播放'}</p>
  <div className="flow-motion-list nodrag nowheel nopan">{d.motions.map(m=><div className={'flow-motion-row '+(d.clip===m.index&&!d.candidate?'active':'')} key={m.index}>
   <input aria-label={'用'+motionName(m.name)+'制作序列帧'} type="checkbox" checked={d.chosen.includes(m.index)} disabled={d.busy} onChange={()=>d.toggle(m.index)}/>
   <button className="flow-play-action" aria-label={'播放动作：'+motionName(m.name)} onClick={()=>d.play(m.index)}><Play size={13}/><span>{motionName(m.name)}</span></button>
   <button className="icon-button" aria-label={'移除'+motionName(m.name)} disabled={d.busy} onClick={()=>d.remove(m.index)}><X size={13}/></button>
  </div>)}</div>
  {!d.motions.length&&<p className="flow-placeholder-note">{needsRig?'这个模型只有外观，还没有控制动作的骨骼。到 Mixamo 绑定一次，导回后就能使用动作库。':d.confirmed?'还没有选用动作。先添加一个试试看。':'先在顶部选用模型，自带动作也需要确认后加入。'}</p>}
  <button className="secondary full nodrag" disabled={!d.confirmed||d.busy} onClick={needsRig?d.mixamo:d.add}><Plus size={14}/>{needsRig?'先绑定骨骼':'添加动作'}</button>
  {d.picker&&!needsRig&&<div className="flow-inline-box flow-motion-picker nodrag nowheel nopan">
   <div className="flow-picker-title"><strong>挑一个动作，先看效果</strong><button className="icon-button" aria-label="收起动作选择" onClick={d.closePicker}><X size={14}/></button></div>
   <label className="flow-search"><Search size={14}/><input value={d.query} onChange={e=>d.setQuery(e.target.value)} placeholder="搜索行走、拳击…" aria-label="搜索待选动作"/></label>
   <SelectField label="动作来源" value={d.sourceFilter} onChange={d.setSourceFilter} options={d.sourceOptions}/>
   <div className="flow-candidates">{d.candidates.map(v=><button key={v.key} className={'flow-candidate '+(d.candidate?.key===v.key?'active':'')} onClick={()=>d.audition(v)} disabled={d.busy}>
    <Play size={13}/><span><strong>{v.label}</strong><small>{v.sourceName}</small></span><small>{v.duration?.toFixed(1)}s</small>
   </button>)}</div>
   {!d.candidates.length&&<p>没有匹配的待选动作。可以导入文件或去 Mixamo 获取。</p>}
   {d.more&&<button className="text-button" onClick={d.showMore}>再显示一些候选</button>}
   <div className="flow-import-actions"><button className="text-button" onClick={d.importMotion}>导入动作</button><button className="text-button" onClick={d.mixamo}>去 Mixamo 获取</button></div>
  </div>}
  {d.candidate&&!needsRig&&<div className="flow-audition nodrag nopan" aria-live="polite"><strong>{d.candidate.label}</strong><p>{d.previewError|| (d.sourceMode?'正在播放来源模型，点候选旁的 ▶ 查看目标效果后再确认。':d.auditionReady?'在本框查看效果，满意后加入。':d.previewRecord?.stage||'正在准备目标模型上的试播…')}</p>
   {!d.previewError&&!d.auditionReady&&!d.sourceMode&&<ProgressBar value={null} label="准备动作试播"/>}
   {d.candidate.assetId!==d.modelId&&<details className="flow-details"><summary>动作来源</summary><button className="flow-sprite-play" aria-label="播放动作来源模型" onClick={d.playSource}><Play size={13}/>{d.candidate.sourceName}</button></details>}
   <div className="flow-audition-buttons"><button className="primary" disabled={!d.auditionReady||d.busy||d.sourceMode||!!d.previewError} onClick={d.confirmMotion}><Check size={13}/>确认加入</button><button className="text-button" disabled={d.busy} onClick={d.cancelAudition}>取消</button></div>
  </div>}
  {d.job&&<div className="flow-job nodrag" role="status"><strong>{running(d.job)?'正在添加动作':d.job.state==='succeeded'?'动作已组合，正在整理':'动作未完成'}</strong><p>{d.job.error||d.job.stage}</p>{running(d.job)&&<ProgressBar value={d.job.total?d.job.done/d.job.total*100:null} label="动作组合进度"/>}</div>}
  {d.mixamoOpen&&<div className="flow-inline-box flow-rigging-panel nodrag nowheel nopan"><div className="flow-picker-title"><strong>{needsRig?'给模型绑定骨骼':'Mixamo 获取动作'}</strong><button className="icon-button" aria-label="收起 Mixamo" onClick={d.closeMixamo}><X size={14}/></button></div><MixamoDrawer inline open model={d.model} assets={d.assets} jobs={d.jobs} api={d.api} onRefresh={d.refresh} onOpenChange={d.setMixamoOpen} onViewMotions={d.imported} beforeAdopt={d.beforeAdopt} onUseModel={d.previewModel}/></div>}
  {d.confirmed&&<button className="secondary full flow-download nodrag" disabled={d.busy} onClick={d.download}><Download size={14}/>{d.exporting?'正在整理文件…':'下载模型 · '+d.motions.length+' 个动作'}</button>}
  <p className="flow-fineprint">勾选动作用于右侧序列帧。移除后，下载也只保留这里的动作。</p>
  <Handle type="source" position={Position.Right} id="motions-out"/>
 </section>;
}
function FramesNode({data:d}){
 return <section className="flow-card flow-set">
  <Handle type="target" position={Position.Left} id="in"/>
  <header><Film size={17}/><strong>03 · 序列帧</strong><small>{d.preparedSet?.actions.length||d.chosen.length} 个动作</small></header>
  {d.request?<div className="flow-onion-wrap nodrag nowheel nopan"><FrameReviewDrawer inline open request={d.request} api={d.api} onRefresh={d.refresh} onPrepared={d.prepared} initialPlayback={d.onionPlayback} onPlaybackChange={d.onionPlaybackChanged}/></div>:<>
   <div className="flow-frame-view flow-clip-view nodrag nowheel nopan"><Viewer key={d.workspaceKey} asset={d.asset} geometryAsset={d.geometryAsset} initialPlayback={d.framePlayback} onPlaybackChange={d.framePlaybackChanged} clipIndex={d.frameClip} allowedClipIndices={d.chosen} embedded frameMode hideToolbar showClipSelector={false} playSignal={d.framePlaySignal} initialView={d.initialView} onViewChange={d.viewChanged} onViewInteraction={d.viewInteraction} onReady={d.frameReady}/></div>
   <p className="flow-preview-caption">出帧构图 · 拖动调角度，滚轮调大小</p>
   <div className="flow-motion-list flow-frame-actions nodrag nowheel nopan">{d.motions.filter(m=>d.chosen.includes(m.index)).map(m=><div className={'flow-motion-row '+(d.frameClip===m.index?'active':'')} key={m.index}><button className="flow-play-action" aria-label={'预览出帧动作：'+motionName(m.name)} onClick={()=>d.playFrame(m.index)}><Play size={13}/><span>{motionName(m.name)}</span></button></div>)}</div>
   {!d.chosen.length&&<p>先在已选动作中勾选要制作的片段。</p>}
   <details className="flow-details nodrag"><summary>图片设置</summary><label>图片大小<SelectField label="图片大小" value={d.size} onChange={v=>d.setSize(+v)} options={[256,512,1024].map(v=>({value:v,label:v+' × '+v}))}/></label><label>帧率<SelectField label="序列帧率" value={d.fps} onChange={v=>d.setFps(+v)} options={[12,24,30].map(v=>({value:v,label:v+' 帧 / 秒'}))}/></label></details>
   <button className="primary full nodrag" disabled={!d.canGenerate} onClick={d.generate}>{d.viewMoving?<LoaderCircle className="spin" size={14}/>:<Film size={14}/>}确认构图，生成 {d.chosen.length} 个动作</button>
  </>}
  {d.preparedSet&&d.preparedSet.sourceAssetId!==d.modelId&&<p className="flow-preview-caption">已完成的序列帧保留原模型版本；新增动作可重新构图制作。</p>}
  {d.request&&<button className="text-button nodrag" onClick={d.closeReview}>重新调整构图</button>}
  {!d.request&&!!(d.sets.length||d.previousSets.length)&&<div className="flow-saved-frames nodrag"><strong>上次完成的序列帧</strong><a className="button secondary full" href={(d.sets[0]||d.previousSets[0]).downloadUrl}><Download size={14}/>下载整套序列帧 · {(d.sets[0]||d.previousSets[0]).actions.length} 个动作</a><button className="flow-sprite-play" onClick={()=>d.openSet((d.sets[0]||d.previousSets[0]).id)}><Play size={13}/>继续查看上次的序列帧</button></div>}
  {!!d.previousSets.length&&<details className="flow-details nodrag nowheel"><summary>以前完成的序列帧 · {d.previousSets.length} 套</summary>{d.previousSets.map(set=><div key={set.id}><button className="flow-sprite-play" onClick={()=>d.openSet(set.id)}><Play size={13}/>{set.actions.length} 个动作 · {set.sourceModelName}</button><a href={set.downloadUrl}>下载这套 ZIP</a></div>)}</details>}
  {!!d.sets.length&&<details className="flow-details nodrag nowheel"><summary>已保存的序列帧 · {d.sets.length} 套</summary>{d.sets.map(s=><button key={s.id} className="flow-sprite-play" aria-label={'播放序列帧动作集：'+s.actions.map(a=>motionName(a.name)).join('、')} onClick={()=>d.openSet(s.id)}><Play size={13}/><span>{s.actions.map(a=>motionName(a.name)).join('、')}</span></button>)}</details>}
  {!!d.candidateSets.length&&<details className="flow-details nodrag nowheel"><summary>历史序列帧 · {d.candidateSets.length} 套待选</summary>{d.candidateSets.map(s=><button key={s.id} className="flow-sprite-play" onClick={()=>d.openSet(s.id)}><Play size={13}/><span>{s.actions.map(a=>motionName(a.name)).join('、')}</span></button>)}</details>}
  {d.preparedSet&&d.preparedSet.sourceAssetId===d.modelId&&!d.sets.some(s=>s.id===d.preparedSet.id)&&<button className="secondary full nodrag" onClick={d.keepSet}>保留这套序列帧到工作台</button>}
 </section>;
}
const nodeTypes={model:ModelNode,motions:MotionsNode,sprites:FramesNode};

export default function AssetFlow({assets,jobs,api,onRefresh,onNavigate,intent,workspace}){
 const initial=new URLSearchParams(location.search);
 const [modelId,setModelId]=useState(()=>initial.get('flowModel')||initial.get('workModel')||initial.get('model')||''),[flow,setFlow]=useState(null),[revision,setRevision]=useState(0);
 const [clip,setClip]=useState(-1),[chosen,setChosen]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[exporting,setExporting]=useState(false);
 const [picker,setPicker]=useState(false),[query,setQuery]=useState(''),[sourceFilter,setSourceFilter]=useState('current'),[limit,setLimit]=useState(6),[candidate,setCandidate]=useState(null),[previewRecord,setPreviewRecord]=useState(null),[previewError,setPreviewError]=useState(''),[previewReady,setPreviewReady]=useState(false),[sourceMode,setSourceMode]=useState(false),[modelReady,setModelReady]=useState(false),[mixamoOpen,setMixamoOpen]=useState(initial.get('panel')==='mixamo');
 const [frameClip,setFrameClip]=useState(-1),[motionPlaySignal,setMotionPlaySignal]=useState(0),[framePlaySignal,setFramePlaySignal]=useState(0),[motionReady,setMotionReady]=useState(false),[frameViewReady,setFrameViewReady]=useState(false);
 const [view,setView]=useState(null),[viewMoving,setViewMoving]=useState(false),[size,setSize]=useState(512),[fps,setFps]=useState(12),[request,setRequest]=useState(()=>initial.get('spriteSet')?{spriteSetId:initial.get('spriteSet')}:initial.get('review')?{reviewId:initial.get('review')}:null),[preparedSet,setPreparedSet]=useState(null);
 const [hydratedId,setHydratedId]=useState(null),[saveStatus,setSaveStatus]=useState('saved'),[creating,setCreating]=useState(false),[naming,setNaming]=useState(false),[pendingName,setPendingName]=useState(''),[newModelId,setNewModelId]=useState('');
 const memory=useRef();if(!memory.current)memory.current=createWorkspaceMemory(api,setSaveStatus);
 const [nodes,setNodes,onNodesChange]=useNodesState([]),[edges,setEdges]=useState([]);
 const instance=useRef(),activeModel=useRef(null),previousClips=useRef([]),layoutQueue=useRef(Promise.resolve()),views=useRef({}),autoKeep=useRef(false),closedReview=useRef(false),finishing=useRef(new Set()),latest=useRef(),positionedModel=useRef(null);
 const asset=assets.find(a=>a.id===(flow?.modelId||modelId));
 const selection=flow?.selection,confirmed=!!selection,job=jobs.find(j=>j.id===selection?.pendingJobId),activeWorkspace=flow?.models.find(m=>m.id===asset?.id),needsName=confirmed&&activeWorkspace?.requiresName!==false,locked=busy||running(job)||job?.state==='succeeded'||needsName;
 const statusKey=[assets.length,workspace?.selection?.revision,workspace?.activeModelId,jobs.filter(j=>j.params.modelId===modelId&&['compose','frames','review-frames'].includes(j.type)).map(j=>j.id+j.state+j.done).join('|')].join(':');
 const catalog=useMemo(()=>buildMotionCatalog(assets,jobs,asset),[assets,jobs,asset]);
 const allCandidates=useMemo(()=>{
  const own=(asset?flow?.candidateMotions||[]:[]).map(m=>({key:asset.id+':'+m.index,assetId:asset.id,index:m.index,label:motionName(m.name),sourceName:'当前模型自带',duration:m.duration,source:asset}));
  return [...own,...[...catalog.variants.values()].filter(v=>v.assetId!==asset?.id&&!v.existing)];
 },[flow,asset,catalog]);
 const filterCandidates=allCandidates.filter(v=>(sourceFilter==='all'||sourceFilter==='current'&&v.assetId===asset?.id||v.assetId===sourceFilter)&&(!query||[v.label,v.sourceName,v.raw].join(' ').toLowerCase().includes(query.toLowerCase())));
 const modelOptions=(flow?.models||[]).map(a=>({value:a.id,label:a.name}));
 latest.current={flow,asset,selection,candidate,sourceMode,chosen,clip,view,size,fps,request,preparedSet};
 const reload=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{let gone=false;api('asset-flow',modelId?{modelId}:{}).then(r=>{if(gone)return;if(!modelId&&r.modelId)setModelId(r.modelId);setFlow(prev=>prev?.revision===r.revision&&JSON.stringify(prev.models)===JSON.stringify(r.models)?prev:r);}).catch(e=>{if(!gone)setError(e.message);});return()=>{gone=true;};},[modelId,revision,statusKey]);
 useEffect(()=>{
  if(!flow?.modelId||!asset)return;const changed=activeModel.current!==flow.modelId,indices=flow.motions.map(m=>m.index);
  if(changed){
   const d=memory.current.open(flow);activeModel.current=flow.modelId;
   const chosenNext=Array.isArray(d.chosen)?[...d.chosen.filter(i=>indices.includes(i)),...indices.filter(i=>!(d.knownClips||indices).includes(i))]:indices;
   setChosen(chosenNext);setClip(indices.includes(d.clip)?d.clip:indices[0]??-1);setFrameClip(chosenNext.includes(d.frameClip)?d.frameClip:chosenNext[0]??-1);
   setView(d.view||null);views.current[flow.modelId]=d.view||null;setSize(d.size||512);setFps(d.fps||12);
   setPicker(!!d.picker);setQuery(d.query||'');setSourceFilter(d.sourceFilter||'current');setLimit(d.limit||6);setMixamoOpen(!!d.mixamoOpen||initial.get('panel')==='mixamo');
   const saved=asset.metadata.boneCount&&d.candidate&&allCandidates.find(v=>v.assetId===d.candidate.assetId&&v.index===d.candidate.index);setCandidate(saved?{...saved,audition:Date.now()}:null);setSourceMode(!!saved&&!!d.sourceMode);setPreviewRecord(null);setPreviewReady(false);
   closedReview.current=!!d.closedReview;autoKeep.current=!!d.autoKeep;
   const deep=!hydratedId&&(initial.get('spriteSet')?{spriteSetId:initial.get('spriteSet')}:initial.get('review')?{reviewId:initial.get('review')}:null);
   const resume=d.request||(!d.closedReview&&flow.renderSession?.sourceHash===asset.sha256?flow.renderSession.request:null);
   setRequest(deep||resume||null);if(resume?.workspace)autoKeep.current=true;
   setPreparedSet(previous=>previous?.id===d.preparedSetId?previous:null);setHydratedId(flow.modelId);setPendingName('');
  }else{setChosen(v=>[...v.filter(i=>indices.includes(i)),...indices.filter(i=>!previousClips.current.includes(i))]);setClip(v=>indices.includes(v)?v:indices[0]??-1);}
  previousClips.current=indices;
 },[flow?.modelId,selection?.revision,asset?.id]);
 useEffect(()=>{if(hydratedId===flow?.modelId)setFrameClip(i=>chosen.includes(i)?i:chosen[0]??-1);},[chosen,hydratedId]);
 useEffect(()=>{
  if(!hydratedId||hydratedId!==flow?.modelId)return;
  memory.current.update({clip,chosen,knownClips:flow.motions.map(m=>m.index),frameClip,view,size,fps,picker,query,sourceFilter,limit,candidate:candidate?{assetId:candidate.assetId,index:candidate.index,previewId:previewRecord?.id||null}:null,sourceMode,mixamoOpen,request,preparedSetId:preparedSet?.id||null,autoKeep:autoKeep.current,closedReview:closedReview.current});
 },[hydratedId,clip,chosen,frameClip,view,size,fps,picker,query,sourceFilter,limit,candidate,previewRecord?.id,sourceMode,mixamoOpen,request,preparedSet?.id]);
 useEffect(()=>{const save=()=>memory.current.flush(true);const visibility=()=>{if(document.hidden)save();};addEventListener('pagehide',save);document.addEventListener('visibilitychange',visibility);return()=>{removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',visibility);memory.current.dispose();};},[]);
 useEffect(()=>{if(nodes.length!==3||!hydratedId||positionedModel.current===hydratedId)return;positionedModel.current=hydratedId;const viewport=memory.current.data().viewport;const frame=requestAnimationFrame(()=>{if(viewport)instance.current?.setViewport(viewport);else instance.current?.fitView({padding:.04,maxZoom:1});});return()=>cancelAnimationFrame(frame);},[nodes.length,hydratedId]);
 useEffect(()=>{if(!intent)return;if(intent.modelId){changeModel(intent.modelId);if(intent.modelId===flow?.modelId&&selection?.clipIndices.includes(intent.clipIndex))setClip(intent.clipIndex);}if(intent.sourceAssetId){setPicker(true);setSourceFilter(intent.sourceAssetId);}if(intent.spriteSetId)setRequest({spriteSetId:intent.spriteSetId});if(intent.mixamo)setMixamoOpen(true);},[intent?.nonce]);
 useEffect(()=>{if(job?.state!=='succeeded'||finishing.current.has(job.id))return;finishing.current.add(job.id);memory.current.flush().then(()=>api('workspace/complete',{jobId:job.id})).then(async r=>{setCandidate(null);setPreviewRecord(null);await onRefresh();setModelId(r.modelId);const u=new URL(location.href);u.search='?panel=flow&flowModel='+r.modelId;history.replaceState(null,'',u);}).catch(e=>{finishing.current.delete(job.id);setError(e.message);});},[job?.id,job?.state]);
 useEffect(()=>{
  if(!candidate||candidate.assetId===asset?.id||!asset?.metadata.boneCount)return;
  let gone=false,timer;setPreviewRecord(null);setPreviewError('');setPreviewReady(false);
  async function poll(record){if(gone)return;setPreviewRecord(record);if(running(record))timer=setTimeout(async()=>{try{await poll(await api('motion-previews/'+record.id));}catch(e){if(!gone)setPreviewError(e.message);}},600);else if(record.state!=='succeeded')setPreviewError(record.error||record.stage);}
  api('motion-preview',{modelId:asset.id,assetId:candidate.assetId,index:candidate.index}).then(poll).catch(e=>{if(!gone)setPreviewError(e.message);});
  return()=>{gone=true;clearTimeout(timer);};
 },[candidate?.key,candidate?.audition,asset?.id]);
 function changeModel(id){if(id===modelId)return;memory.current.flush();setModelId(id);setError('');const u=new URL(location.href);u.search='?panel=flow&flowModel='+id;history.replaceState(null,'',u);const known=assets.find(a=>a.id===id);if(known&&flow?.models.some(a=>a.id===id))api('workspace/select',{modelId:id,sourceHash:known.sha256}).then(onRefresh).catch(e=>setError(e.message));}
 async function action(fn){setBusy(true);setError('');try{return await fn();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function updateSelection(patch){const f=latest.current.flow;const r=await api('workspace/selection',{modelId:f.modelId,revision:f.selection.revision,...patch});reload();await onRefresh();return r;}
 function audition(v){if(!asset?.metadata.boneCount){setPicker(false);setMixamoOpen(true);return;}setMotionPlaySignal(n=>n+1);setCandidate({...v,audition:Date.now()});setSourceMode(false);setPreviewRecord(null);setPreviewError('');setPreviewReady(false);if(v.assetId===asset.id){setClip(v.index);if(clip===v.index&&motionReady&&!sourceMode)setPreviewReady(true);}}
 function cancelAudition(){setCandidate(null);setPreviewRecord(null);setSourceMode(false);setClip(latest.current.flow?.motions[0]?.index??-1);}
 function play(index){setMotionPlaySignal(n=>n+1);setCandidate(null);setPreviewRecord(null);setSourceMode(false);setClip(index);}
 function playFrame(index){setFrameClip(index);setFramePlaySignal(n=>n+1);}
 async function confirmModel(event){event?.preventDefault();await action(async()=>{const id=creating?newModelId:asset?.id,model=assets.find(a=>a.id===id);if(!pendingName.trim())throw Error('请先给工作台起个名字');if(!creating&&confirmed)await api('workspace/name',{modelId:id,name:pendingName.trim()});else await api('workspace/select',{modelId:id,sourceHash:model?.sha256,name:pendingName.trim()});setCreating(false);setNaming(false);setPendingName('');await onRefresh();changeModel(id);reload();});}
 async function confirmMotion(){await action(async()=>{
  const c=latest.current.candidate,s=latest.current.selection;
  if(c.assetId===asset.id){await updateSelection({clipIndices:[...s.clipIndices,c.index]});cancelAudition();setClip(c.index);}
  else{await memory.current.flush();await api('workspace/compose',{modelId:asset.id,revision:s.revision,candidate:{assetId:c.assetId,index:c.index,previewId:previewRecord.id,name:c.label}});reload();await onRefresh();}
 });}
 async function download(){setExporting(true);await action(async()=>{
  const response=await api('workspace/export',{modelId:asset.id,revision:selection.revision});let url=response.url;
  if(response.job){let j=response.job;while(running(j)){await new Promise(r=>setTimeout(r,700));j=await api('jobs/'+j.id);}if(j.state!=='succeeded')throw Error(j.error||j.stage);url='/api/assets/'+j.outputs[0]+'/download?exact=1';}
  const a=document.createElement('a');a.href=url;a.download='character.glb';a.click();await onRefresh();
 });setExporting(false);}
 const baseReady=useCallback((ok,message)=>{setModelReady(ok);if(message)setError(message);},[]);
 const ready=useCallback((ok,message)=>{setMotionReady(ok);if(message)setError(message);const l=latest.current;if(l.candidate&&l.asset&&l.candidate.assetId===l.asset.id&&!l.sourceMode)setPreviewReady(ok);},[]);
 const frameReady=useCallback((ok,message)=>{setFrameViewReady(ok);if(message)setError(message);},[]);
 const previewLoaded=useCallback((ok,message)=>{setPreviewReady(ok);if(message)setPreviewError(message);},[]);
 const viewChanged=useCallback(v=>{setView(v);setViewMoving(false);if(latest.current.asset)views.current[latest.current.asset.id]=v;},[]);
 const viewInteraction=useCallback(()=>setViewMoving(true),[]);
 function generate(){closedReview.current=false;autoKeep.current=true;setPreparedSet(null);setRequest({modelId:asset.id,clips:[...chosen],view:structuredClone(view),size,fps,workspace:true});}
 async function keepSet(set=latest.current.preparedSet){
  if(!set)return;if(set.sourceAssetId!==latest.current.asset?.id){reload();onRefresh();return;}await action(async()=>{const f=await api('asset-flow',{modelId:set.sourceAssetId});if(!f.selection||!set.actions.every(a=>f.selection.clipIndices.includes(a.clipIndex)))throw Error('这套历史帧含有尚未选用的动作。先在动作节点试播并确认选用。');await api('workspace/selection',{modelId:f.modelId,revision:f.selection.revision,spriteSetIds:[...new Set([...f.selection.spriteSetIds,set.id])]});reload();await onRefresh();});
 }
 const prepared=useCallback(set=>{setPreparedSet(set);memory.current.update({preparedSetId:set.id});if(autoKeep.current){autoKeep.current=false;keepSet(set);}},[]);
 useEffect(()=>{
  if(!flow||flow.modelId&&(!asset||hydratedId!==flow.modelId))return;
  const displayAsset=sourceMode?candidate?.source:asset,displayClip=sourceMode?candidate?.index:candidate&&candidate.assetId===asset?.id?candidate.index:clip;
  const sources=[...new Map(allCandidates.filter(v=>v.assetId!==asset?.id).map(v=>[v.assetId,{value:v.assetId,label:v.sourceName}])).values()];
  const d=memory.current.data(),geometryAsset=assets.find(a=>a.id===flow.previewModelId)||asset;
  const shared={beforeAdopt:()=>memory.current.flush(),workspaceKey:selection?.workspaceId||asset?.id,geometryAsset,busy:locked,confirmed,modelId:asset?.id,motions:flow.motions||[],chosen,asset,candidate,sourceMode,api,refresh:onRefresh,previewModel:changeModel};
  const allowed=sourceMode?[candidate.index]:[...new Set([...(selection?.clipIndices||[]),...(candidate&&candidate.assetId===asset?.id?[candidate.index]:[])])];
  const arranged=[
   {id:'model',type:'model',position:{x:25,y:25},data:{...shared,baseReady,modelView:d.modelView,modelViewChanged:rememberModelView}},
   {id:'motions',type:'motions',position:{x:345,y:25},data:{...shared,clip,job,play,displayAsset,displayClip,allowed,motionView:d.motionView,motionViewChanged:rememberMotionView,motionPlayback:d.motionPlayback,motionPlaybackChanged:rememberMotionPlayback,animationPreview:!sourceMode&&previewRecord?.state==='succeeded'?{...previewRecord,displayName:candidate?.label}:null,motionPlaySignal,ready,previewReady:previewLoaded,playSource:()=>{setSourceMode(true);setPreviewReady(false);setMotionPlaySignal(n=>n+1);},download,exporting,remove:i=>action(async()=>{await updateSelection({clipIndices:selection.clipIndices.filter(k=>k!==i)});autoKeep.current=false;setRequest(null);setPreparedSet(null);}),toggle:i=>setChosen(v=>v.includes(i)?v.filter(k=>k!==i):[...v,i]),add:()=>{setPicker(true);if(!(flow.candidateMotions||[]).length)setSourceFilter('all');},picker,query,setQuery:v=>{setQuery(v);setLimit(6);},sourceFilter,setSourceFilter:v=>{setSourceFilter(v);setLimit(6);},sourceOptions:[{value:'current',label:'当前模型自带'},{value:'all',label:'全部待选来源'},...sources],candidates:filterCandidates.slice(0,limit),more:filterCandidates.length>limit,showMore:()=>setLimit(v=>v+6),closePicker:()=>setPicker(false),audition,cancelAudition,confirmMotion,previewRecord,previewError,auditionReady:previewReady&&!sourceMode,importMotion:()=>onNavigate('import-motion',{}),mixamo:()=>{setPicker(false);setMixamoOpen(true);},mixamoOpen,closeMixamo:()=>setMixamoOpen(false),setMixamoOpen,model:asset,assets,jobs,imported:id=>{setMixamoOpen(false);setSourceFilter(id);setPicker(true);}}},
   {id:'frames',type:'sprites',position:{x:780,y:25},data:{...shared,framePlayback:d.framePlayback,framePlaybackChanged:rememberFramePlayback,onionPlayback:d.onionPlayback,onionPlaybackChanged:rememberOnion,previousSets:flow.previousSpriteSets||[],frameClip,playFrame,framePlaySignal,frameReady,initialView:views.current[asset?.id],viewChanged,viewInteraction,size,setSize,fps,setFps,sets:flow.spriteSets||[],candidateSets:flow.candidateSets||[],request,preparedSet,prepared,keepSet:()=>keepSet(),viewMoving,canGenerate:confirmed&&!!chosen.length&&!!view&&frameViewReady&&!viewMoving&&!locked,generate,openSet:id=>{autoKeep.current=false;setPreparedSet(null);setRequest({spriteSetId:id});},closeReview:()=>{closedReview.current=true;autoKeep.current=false;setRequest(null);setPreparedSet(null);}}}
  ];
  setNodes(old=>arranged.map(n=>({...n,deletable:false,position:d.positions?.[n.id]||old.find(o=>o.id===n.id)?.position||(flow.layout?.version===3?flow.layout.positions?.[n.id]:null)||n.position})));
  setEdges([{id:'model-motions',source:'model',sourceHandle:'model-out',target:'motions',targetHandle:'in',label:'选用动作'},{id:'motions-frames',source:'motions',sourceHandle:'motions-out',target:'frames',targetHandle:'in',label:request||flow.spriteSets?.length?'生成序列帧':'确认后生成',style:{strokeDasharray:request||flow.spriteSets?.length?undefined:'5 5'}}].map(e=>({...e,type:'smoothstep',deletable:false,reconnectable:false,markerEnd:{type:MarkerType.ArrowClosed,width:16,height:16},style:{stroke:'#91ad9b',strokeWidth:1.5,...e.style},labelStyle:{fill:'#708d7b',fontSize:10},labelBgStyle:{fill:'#f7f9f4'}})));
 },[flow,assets,jobs,hydratedId,chosen,clip,frameClip,motionPlaySignal,framePlaySignal,frameViewReady,locked,picker,query,sourceFilter,limit,candidate,previewRecord,previewError,previewReady,sourceMode,modelReady,view,viewMoving,size,fps,request,preparedSet,mixamoOpen,exporting]);
 const rememberModelView=useCallback(view=>memory.current.update({modelView:view}),[]);
 const rememberMotionView=useCallback(view=>{if(!latest.current.sourceMode)memory.current.update({motionView:view});},[]);
 const rememberMotionPlayback=useCallback(value=>{if(!latest.current.candidate)memory.current.update({motionPlayback:value});},[]);
 const rememberFramePlayback=useCallback(value=>memory.current.update({framePlayback:value}),[]);
 const rememberOnion=useCallback(value=>memory.current.update({onionPlayback:value}),[]);
 function storePositions(){if(!asset)return;const positions=Object.fromEntries((instance.current?.getNodes()||nodes).map(n=>[n.id,n.position]));memory.current.update({positions});layoutQueue.current=layoutQueue.current.catch(()=>{}).then(()=>api('asset-flow/layout',{modelId:asset.id,positions})).catch(e=>setError(e.message));}
 function focus(id){const n=instance.current?.getNode(id);if(n)instance.current.fitView({nodes:[n],padding:.12,maxZoom:1,duration:250});}
 return <section className="asset-flow-workbench">
  <div className="flow-toolbar"><div className="flow-workspace-model"><GitBranch size={17}/><strong>我的工作台</strong><SelectField label="工作台" value={confirmed?asset?.id:''} onChange={changeModel} options={modelOptions}/><button className="text-button" onClick={()=>{setCreating(true);setNaming(false);setPendingName('');setNewModelId(flow?.candidateModels?.[0]?.id||'');}}><Plus size={13}/>新建</button>{confirmed&&!needsName&&<button className="text-button" onClick={()=>{setNaming(true);setPendingName(activeWorkspace.name);}}>改名</button>}<small className="flow-save-status" role="status">{saveStatus==='saving'?'正在保存…':saveStatus==='local'?'已记在本机，等待同步':'进度已保存'}</small></div><div className="flow-focus"><button onClick={()=>focus('model')}>看模型</button><button onClick={()=>focus('motions')}>看动作</button><button onClick={()=>focus('frames')}>看序列帧</button><button onClick={()=>instance.current?.fitView({padding:.04,maxZoom:1,duration:250})}>全图</button></div></div>
  {(creating||naming||needsName||asset&&!confirmed)&&<form className="flow-name-form" onSubmit={confirmModel}><label>{creating?'新工作台名称':'先给工作台起个名字'}<input required maxLength={60} placeholder="例如：士兵的基础动作" value={pendingName} onChange={e=>setPendingName(e.target.value)}/></label>{creating&&<SelectField label="新工作台的模型" value={newModelId} onChange={setNewModelId} options={(flow?.candidateModels||[]).map(a=>({value:a.id,label:a.name}))}/>}<button className="primary compact" disabled={busy||!pendingName.trim()||creating&&!newModelId} type="submit"><Check size={13}/>{creating||!confirmed?'命名并创建':'保存名称'}</button>{(creating||naming)&&<button type="button" className="text-button" onClick={()=>{setCreating(false);setNaming(false);}}>取消</button>}</form>}
  {!!flow?.ancestry?.length&&<details className="flow-provenance"><summary>模型来源</summary>{flow.ancestry.map(a=><span key={a.id}>{a.name}</span>)}</details>}
  {error&&<div className="flow-error" role="alert">{error}<button className="icon-button" onClick={()=>setError('')} aria-label="关闭错误"><X size={13}/></button></div>}
  <div className="asset-flow-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeDragStop={storePositions} onInit={v=>instance.current=v} onMoveEnd={(event,viewport)=>{if(hydratedId)memory.current.update({viewport});}} minZoom={.35} maxZoom={1.2} deleteKeyCode={null} edgesReconnectable={false} onConnect={c=>{if(c.source==='model'&&c.target==='motions'&&confirmed)setPicker(true);if(c.source==='motions'&&c.target==='frames')focus('frames');}} isValidConnection={c=>(c.source==='model'&&c.target==='motions')||(c.source==='motions'&&c.target==='frames')}><Background color="#d4dfd4" gap={22} size={1}/><Controls showInteractive={false}/></ReactFlow></div>
  <footer className="flow-help"><span>拖动空白处移动工作台 · 各框独立预览</span><span>点动作旁的 ▶ 播放 · 序列帧确认构图后才生成</span></footer>
 </section>;
}
