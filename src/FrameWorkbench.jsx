import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight,Download,Film,LoaderCircle,Minus,Plus,RotateCcw,RefreshCw,Check} from 'lucide-react';
import Viewer from './Viewer.jsx';
import {SelectField,ProgressBar} from './components/ui.jsx';
import {motionName,rawMotionName} from './motion-labels.js';
import FrameReviewDrawer from './FrameReviewDrawer.jsx';
const loadViews=()=>{try{return JSON.parse(localStorage.getItem('wb-frame-views')||'{}');}catch{return {};}};

export default function FrameWorkbench({presets=[],jobs=[],model,modelPicker,clipIndex,onClip,api,onRefresh,onAddMotions,requestedClips=null}){
  const [views,setViews]=useState(loadViews),[view,setView]=useState(null),[controls,setControls]=useState(null),[dragging,setDragging]=useState(false);
  const [size,setSize]=useState(512),[fps,setFps]=useState(24),[manual,setManual]=useState(null);
  const [work,setWork]=useState(null),[lastGood,setLastGood]=useState(null),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
  const generation=useRef(0);
  const [reviewOpen,setReviewOpen]=useState(()=>{const p=new URLSearchParams(location.search);return p.has('review')||p.has('spriteSet');}),[reviewRequest,setReviewRequest]=useState(null),[extraClips,setExtraClips]=useState([]),[batchId,setBatchId]=useState(null),[batchStarting,setBatchStarting]=useState(false);
  const batch=jobs.find(j=>j.id===batchId)||jobs.find(j=>j.type==='frames'&&j.params.modelId===model?.id);
  async function makeBatch(){setSaveError('');setBatchStarting(true);try{const preset=await api('frame-presets',{modelId:model.id,clipIndex,view,size,fps});const j=await api('frames',{modelId:model.id,clips:[...new Set([clipIndex,...extraClips])],presetId:preset.id});setBatchId(j.id);await onRefresh();}catch(e){setSaveError(e.message);}finally{setBatchStarting(false);}}
  function showReview(body){setReviewRequest(body||{modelId:model.id,clips:[...new Set([clipIndex,...extraClips])],view,size,fps});setReviewOpen(true);}
  function closeReview(next){setReviewOpen(next);if(!next){const url=new URL(location.href);url.searchParams.delete('review');url.searchParams.delete('spriteSet');history.replaceState(null,'',url);}}
  const clips=(model?.metadata.animations||[]).filter(c=>!c.reference),clip=clips.find(c=>c.index===clipIndex);
  const requestKey=model&&clip&&view?JSON.stringify({modelId:model.id,clipIndex,size,fps,view}):'';
  const current=work?.key===requestKey?work:null,ready=current?.job?.state==='succeeded'&&!dragging;
  const processing=!!manual&&!!current&&!ready&&!current.error;
  const count=clip?Math.max(1,Math.ceil(clip.duration*fps-1e-4)):0;

  useEffect(()=>{setView(null);setLastGood(null);setWork(null);setSaveError('');setExtraClips([]);setBatchId(null);},[model?.id]);
  useEffect(()=>{if(requestedClips&&model&&requestedClips.modelId===model.id&&requestedClips.clips.length){onClip(requestedClips.clips[0]);setExtraClips(requestedClips.clips.slice(1));}},[requestedClips?.nonce,model?.id]);
  useEffect(()=>{localStorage.setItem('wb-frame-views',JSON.stringify(views));},[views]);
  // Editing the view only invalidates a confirmed request. It never starts capture.
  useEffect(()=>{setManual(null);setWork(null);},[requestKey,dragging]);
  useEffect(()=>{
    if(!manual)return;
    const {key,controls:captureControls,count:frameCount}=manual;
    const sequence=++generation.current,controller=new AbortController();let timer;
    const alive=()=>!controller.signal.aborted&&sequence===generation.current;
    const set=value=>{if(alive())setWork({key,...value});};
    async function call(route,body){const response=await fetch('/api/'+route,{signal:controller.signal,...(body?{method:'POST',...(body instanceof FormData?{body}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'预览未完成');return data;}
    async function receive(job){
      if(!alive())return;set({job,message:job.stage,percent:job.total?Math.round(job.done/job.total*100):null});
      if(job.state==='succeeded'){setLastGood(job);onRefresh();}
      else if(['queued','running'].includes(job.state))timer=setTimeout(async()=>{try{await receive(await call('jobs/'+job.id));}catch(e){fail(e);}},500);
      else set({job,error:job.error||job.stage});
    }
    function fail(e){if(e.name!=='AbortError'&&alive())set({error:e.message});}
    async function build(){try{
      if(frameCount>720)throw Error('这个动作超过 720 帧，请在画质设置中降低帧率。');
      const params=JSON.parse(key),preset=await call('frame-presets',params);params.presetId=preset.id;params.viewOrigin='confirmedPreset';const cached=await call('render-view/lookup',params);
      if(cached.job)return receive(cached.job);
      set({message:'正在捕获当前画面',percent:0});
      const frames=await captureControls.capture({...params,signal:controller.signal,onProgress:(done,total)=>set({message:'正在捕获 '+done+' / '+total+' 帧',percent:Math.round(done/total*100)})});
      controller.signal.throwIfAborted();set({message:'正在准备 GIF',percent:null});
      const form=new FormData();form.append('request',JSON.stringify(params));frames.forEach((blob,i)=>form.append('frames',blob,String(i).padStart(4,'0')+'.png'));
      await receive(await call('render-view',form));
    }catch(e){fail(e);}}
    set({message:'正在准备已确认的构图',percent:null});build();
    return()=>{controller.abort();clearTimeout(timer);};
  },[manual]);

  function changed(next){setDragging(false);setView(next);setViews(all=>({...all,[model.id]:next}));}
  async function save(){if(!ready)return;setSaving(true);setSaveError('');try{const result=await api('render-view/'+current.job.id+'/save',{});await onRefresh();const a=document.createElement('a');a.href='/api/assets/'+result.id+'/download';a.download='sprites.zip';a.click();}catch(e){setSaveError(e.message);}finally{setSaving(false);}}
  const status=!model?'先选择一个模型':!clip?'这个模型还没有动作，请先添加动作':dragging?'正在调整构图，确认后再生成 GIF':current?.error?'预览暂未完成':ready?'当前构图已生成 GIF':current?.message||(lastGood?'构图已更改，请确认后重新生成 GIF':'调整好画面，再点击下方按钮生成 GIF');
  return <><div className="work-layout frame-workbench">
    <section className="form-panel"><div className="form-section"><div className="step-label"><span className="step-number">01</span><h2>选择模型</h2></div>{modelPicker}</div>
      <div className="form-section"><div className="step-label"><span className="step-number">02</span><h2>选择动作</h2></div><SelectField label="要导出的动作" value={clipIndex} onChange={v=>onClip(+v)} options={clips.map(c=>({value:c.index,label:motionName(rawMotionName(c,model))}))} placeholder="先为模型添加一个动作"/>
        <p className="frame-instruction">在右边调整角度和角色大小。方框里的画面，就是导出画面。调整好后，点击“确认构图，生成 GIF”。</p>{model&&!clips.length&&<button className="text-button" onClick={onAddMotions}>为这个模型添加动作 <ArrowRight size={13}/></button>}
        <details className="frame-options"><summary>画质设置</summary><label>图片大小<SelectField label="序列图片大小" value={size} onChange={v=>setSize(+v)} options={[256,512,1024].map(v=>({value:v,label:v+' × '+v}))}/></label><label>播放流畅度<SelectField label="序列帧率" value={fps} onChange={v=>setFps(+v)} options={[{value:12,label:'轻量 · 每秒 12 帧'},{value:24,label:'流畅 · 每秒 24 帧'},{value:30,label:'更流畅 · 每秒 30 帧'}]}/></label></details>
      </div>
      <div className="form-action"><button className="primary full" disabled={!ready||saving} onClick={save}>{saving?<><LoaderCircle size={16} className="spin"/>正在保存</>:<>保存并下载序列帧 <Download size={16}/></>}</button><p className="action-note">保存当前预览的原帧，自动加入作品库。</p>{saveError&&<p className="flow-error">{saveError}</p>}
       <details className="frame-batch"><summary>用同一构图再生成几个动作</summary>{clips.filter(c=>c.index!==clipIndex).map(c=><label key={c.index}><input type="checkbox" checked={extraClips.includes(c.index)} onChange={e=>setExtraClips(s=>e.target.checked?[...s,c.index]:s.filter(i=>i!==c.index))}/>{motionName(rawMotionName(c,model))}</label>)}<button className="primary full" disabled={!requestKey||dragging||batchStarting||['queued','running'].includes(batch?.state)} onClick={makeBatch}>确认构图，生成 {new Set([clipIndex,...extraClips]).size} 个动作</button></details>
       {batch&&<div className="frame-batch"><p>{batch.stage}</p>{['queued','running'].includes(batch.state)&&<ProgressBar value={batch.total?batch.done/batch.total*100:null} label="批量动作进度"/>}{batch.outputs?.length>0&&<button className="text-button" onClick={()=>showReview(batch.spriteSetId?{spriteSetId:batch.spriteSetId}:{assetIds:batch.outputs})}>播放这套 2D 动作集</button>}{['failed','interrupted','needs_input'].includes(batch.state)&&<button className="text-button" onClick={async()=>{const j=await api('jobs/'+batch.id+'/retry',{});setBatchId(j.id);onRefresh();}}>继续未完成的动作</button>}</div>}
      </div>
    </section>
    <section className="frame-preview-panel preview-panel"><div className="frame-dual">
      <div className="frame-pane"><header><strong>调整画面</strong><span>拖动旋转 · 滚轮缩放</span></header><Viewer suspended={reviewOpen} key={model?.id} asset={model} clipIndex={clipIndex} onClip={onClip} frameMode initialView={views[model?.id]||presets.filter(p=>p.modelId===model?.id&&p.sourceHash===model?.sha256).sort((a,b)=>b.confirmedAt.localeCompare(a.confirmedAt))[0]?.view} onControlsReady={setControls} onViewChange={changed} onViewInteraction={()=>setDragging(true)} onReady={(ok,error)=>{if(error)setWork({key:requestKey,error});}}/>
        <div className="frame-camera-tools"><div>{[['正面',0],['侧面',90],['背面',180]].map(([label,a])=><button key={a} disabled={!controls} onClick={()=>controls.angle(a)}>{label}</button>)}</div><div><button disabled={!controls} aria-label="缩小角色" onClick={()=>controls.zoom(1.15)}><Minus size={15}/></button><button disabled={!controls} aria-label="放大角色" onClick={()=>controls.zoom(1/1.15)}><Plus size={15}/></button><button disabled={!controls} aria-label="重置构图" onClick={()=>controls.reset()}><RotateCcw size={14}/></button></div></div>
      </div>
      <div className="frame-pane"><header><strong>GIF 预览</strong><span>{ready?count+' 帧 · '+size+' × '+size:'与左侧构图一致'}</span></header><div className={'frame-gif-stage '+(!ready?'updating':'')}>
        {lastGood?<img key={lastGood.id} src={lastGood.preview.gif} alt="当前角色动作 GIF 预览"/>:<div className="frame-gif-empty"><Film size={32} strokeWidth={1.2}/><p>调整画面后，在这里看 GIF</p></div>}
        {!ready&&<div className="frame-gif-status" role="status">{processing?<LoaderCircle size={16} className="spin"/>:null}<span>{status}</span></div>}
      </div><div className="frame-gif-tools"><button className="primary full" disabled={!controls||!requestKey||dragging||processing} onClick={()=>setManual({key:requestKey,controls,count,nonce:Date.now()})}>{processing?<LoaderCircle size={15} className="spin"/>:<RefreshCw size={15}/>} {processing?'正在生成 GIF':ready?'按当前构图重新生成':'确认构图，生成 GIF'}</button></div></div>
    </div>
    <div className="frame-progress" aria-live="polite"><div>{ready?<Check size={15}/>:<Film size={15}/>}<span>{status}</span>{ready&&<a href={current.job.preview.gif} download={model.name+'.gif'}><Download size={14}/>下载 GIF</a>}</div>{processing&&<ProgressBar value={current.percent??null} label="GIF 生成进度"/>}{current?.error&&<p className="flow-error">{current.error}</p>}</div>
    <p className="frame-format-note">GIF 用于看动作；序列帧 PNG 保留完整颜色和透明边缘。</p><div className="frame-review-entry"><button className="text-button" disabled={!requestKey||dragging} onClick={()=>showReview()}>按当前构图洋葱播放 · {new Set([clipIndex,...extraClips]).size} 个动作 <ArrowRight size={14}/></button></div>
    </section>
  </div><FrameReviewDrawer open={reviewOpen} onOpenChange={closeReview} request={reviewRequest} api={api} onRefresh={onRefresh}/></>;
}
