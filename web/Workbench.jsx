import React,{useEffect,useRef,useState} from 'react';
import {Box,Play,Film,Plus,X,Check,CloudUpload,LoaderCircle,ArrowRight,Save,RotateCcw,ZoomIn,ZoomOut,Package,SlidersHorizontal} from 'lucide-react';
import Stage from './Stage.jsx';
import {useModel} from './Library.jsx';
import {parseModel,disposeModel,modelInfo} from './model.js';
import {composeExact,selectAnimations} from './glb.js';
import {packageFrames} from './frames.js';
import {readFile,saveAsset,saveWorkspace,fileRef,newId,connected} from './github.js';

const motionKey=m=>`${m.assetId}:${m.index}`;
function MotionPicker({catalog,selected,onChange,onClose}){
  const [query,setQuery]=useState('');
  const sources=catalog.assets.filter(a=>a.metadata?.animations?.length&&a.primaryPath.endsWith('.glb')&&a.name.toLowerCase().includes(query.toLowerCase()));
  return <div className="modal-backdrop"><section className="dialog motion-dialog" role="dialog" aria-modal="true" aria-labelledby="motion-title"><div className="dialog-header"><div><span className="eyebrow">CHOOSE YOUR MOTIONS</span><h2 id="motion-title">从动作库中选用</h2></div><button className="icon-button" aria-label="关闭动作选择" onClick={onClose}><X size={20}/></button></div><p className="dialog-intro">只组合你明确选用的片段；不同静止骨架需先在外部工具中适配。</p><input aria-label="搜索动作来源" placeholder="搜索来源模型…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="motion-candidates">{sources.map(source=><section key={source.id}><h3><Box size={15}/>{source.name}<small>{source.metadata.animations.length} 个片段</small></h3>{source.metadata.animations.map(clip=>{const ref={assetId:source.id,index:clip.index},picked=selected.some(m=>motionKey(m)===motionKey(ref));return <button className={picked?'picked':''} key={clip.index} onClick={()=>onChange(picked?selected.filter(m=>motionKey(m)!==motionKey(ref)):[...selected,ref])}><span className="check-square">{picked&&<Check size={13}/>}</span><span>{clip.name}</span><small>{clip.duration.toFixed(2)}s</small></button>;})}</section>)}{!sources.length&&<div className="picker-empty">还没有可选动作。可先导入带动作的 GLB 或 FBX。</div>}</div><div className="dialog-footer"><span>已选 {selected.length} 个片段</span><button className="primary" onClick={onClose}><Check size={16}/>完成选用</button></div></section></div>;
}
function initialDraft(){try{return JSON.parse(localStorage.getItem('little-steps-workbench-ui')||'null')||{};}catch{return {};}}
export default function Workbench({catalog,preferredModelId,onCatalog,onConnect,onUpload,onNotify}){
  const initial=useRef(initialDraft()),[workspaceId,setWorkspaceId]=useState(initial.current.id||newId()),[name,setName]=useState(initial.current.name||''),[modelId,setModelId]=useState(preferredModelId||initial.current.modelId||''),[selected,setSelected]=useState(initial.current.motions||[]),[view,setView]=useState(initial.current.view||null),[picker,setPicker]=useState(false),[assembled,setAssembled]=useState(null),[assembling,setAssembling]=useState(false),[assemblyError,setAssemblyError]=useState(''),[playing,setPlaying]=useState(0),[controls,setControls]=useState(null),[size,setSize]=useState(512),[fps,setFps]=useState(12),[result,setResult]=useState(null),[gifUrl,setGifUrl]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[savedFrames,setSavedFrames]=useState(false);
  const captureAbort=useRef(),resultId=useRef(),models=catalog.assets.filter(a=>a.kind==='model'&&a.primaryPath?.endsWith('.glb'));
  const model=catalog.assets.find(a=>a.id===modelId),{value,error:modelError,busy:loading}=useModel(model);
  const picks=selected.map(m=>{const asset=catalog.assets.find(a=>a.id===m.assetId),clip=asset?.metadata?.animations?.find(c=>c.index===m.index);return {...m,asset,clip};}).filter(m=>m.asset&&m.clip);
  useEffect(()=>{if(preferredModelId&&preferredModelId!==modelId){setModelId(preferredModelId);setSelected([]);setResult(null);setView(null);}},[preferredModelId]);
  useEffect(()=>{localStorage.setItem('little-steps-workbench-ui',JSON.stringify({id:workspaceId,name,modelId,motions:selected,view}));},[workspaceId,name,modelId,JSON.stringify(selected),JSON.stringify(view)]);
  useEffect(()=>{if(!result){setGifUrl('');return;}const url=URL.createObjectURL(result.gif);setGifUrl(url);return()=>URL.revokeObjectURL(url);},[result]);
  useEffect(()=>()=>captureAbort.current?.abort(),[]);
  useEffect(()=>{
    let active=true,parsed;setAssembled(null);setAssemblyError('');setPlaying(0);setResult(null);setSavedFrames(false);
    if(!value||!picks.length){setAssembling(false);return;}
    setAssembling(true);
    Promise.all(picks.map(async m=>({bytes:m.assetId===modelId?value.bytes:await (await readFile(m.asset.files.find(f=>f.path===m.asset.primaryPath))).arrayBuffer(),index:m.index,isTarget:m.assetId===modelId}))).then(async inputs=>{const bytes=composeExact(value.bytes,inputs),gltf=await parseModel(bytes);parsed=gltf;if(active)setAssembled({bytes,gltf});else disposeModel(gltf.scene);}).catch(e=>{if(active)setAssemblyError(e.message);}).finally(()=>{if(active)setAssembling(false);});
    return()=>{active=false;if(parsed)disposeModel(parsed.scene);};
  },[value,JSON.stringify(selected)]);
  function chooseModel(id){setModelId(id);setSelected([]);setView(null);setResult(null);setError('');}
  function chooseWorkspace(id){
    const workspace=catalog.workspaces.find(w=>w.id===id);
    setWorkspaceId(workspace?.id||newId());setName(workspace?.name||'');setModelId(workspace?.modelId||'');setSelected(workspace?.motions||[]);setView(workspace?.view||null);setResult(null);
  }
  async function persist(){if(!name.trim()){setError('请先给工作台起一个名字');return;}if(!connected()){onConnect();return;}setBusy(true);setError('');try{const result=await saveWorkspace({id:workspaceId,name:name.trim(),modelId,motions:selected,view,updatedAt:new Date().toISOString()},setProgress);onCatalog(result.catalog);onNotify('工作台已保存到 GitHub');}catch(e){setError(e.message);}finally{setBusy(false);setProgress('');}}
  async function exportModel(){
    if(!connected()){onConnect();return;}if(!value)return;
    setBusy(true);setError('');
    try{
      const bytes=picks.length?assembled.bytes:selectAnimations(value.bytes,[]),blob=new Blob([bytes],{type:'model/gltf-binary'}),id=newId(),path=`assets/${id}/model.glb`;
      const asset={id,name:`${model.name} · ${picks.length} 动作`,kind:'model',modelFamilyId:model.modelFamilyId||model.id,parentId:model.id,source:'工作台动作组合',createdAt:new Date().toISOString(),status:'pending',primaryPath:path,posterPath:model.posterPath,files:[fileRef(path,blob),...model.files.filter(f=>f.path===model.posterPath)],metadata:picks.length?modelInfo(assembled.gltf):{...model.metadata,animations:[]},motionOrigins:selected};
      const output=await saveAsset(asset,[{path,blob}],setProgress);onCatalog(output.catalog);onNotify('选用动作已保存为模型的新版本，原模型保留');
    }catch(e){setError(e.message);}finally{setBusy(false);setProgress('');}
  }
  async function generate(){
    if(!controls||!assembled||!picks.length)return;
    const count=picks.reduce((n,m)=>n+Math.max(1,Math.ceil(m.clip.duration*fps-1e-4)),0);
    if(count>720){setError(`本次共有 ${count} 帧，超过 720 帧。请降低帧率或减少片段。`);return;}
    setBusy(true);setError('');setResult(null);setSavedFrames(false);captureAbort.current=new AbortController();
    try{
      const frames=[],clips=[],savedView=controls.getView();
      for(let index=0;index<picks.length;index++){
        const pick=picks[index];setProgress(`捕获「${pick.clip.name}」…`);
        const produced=await controls.capture({clipIndex:index,size,fps,signal:captureAbort.current.signal,onProgress:(n,total)=>setProgress(`捕获 ${index+1} / ${picks.length} · ${n} / ${total} 帧`)});
        clips.push({...selected[index],name:pick.clip.name,start:frames.length,count:produced.length,duration:pick.clip.duration});frames.push(...produced);
      }
      const packed=await packageFrames({frames,size,fps,clips,view:savedView,name:`${model.name} · 2D 动作集`,sourceId:model.id,onProgress:setProgress,signal:captureAbort.current.signal});
      resultId.current=newId();setResult(packed);onNotify('序列帧预览已生成；确认后保存到云端');
    }catch(e){if(e.name==='AbortError')onNotify('已取消生成');else setError(e.message);}finally{setBusy(false);setProgress('');captureAbort.current=null;}
  }
  async function storeFrames(){
    if(!connected()){onConnect();return;}if(!result)return;
    setBusy(true);setError('');
    try{
      const id=resultId.current,entries=[['frames.zip',result.zip],['animation.gif',result.gif],['frames.json',result.json],['cover.png',result.poster]],files=entries.map(([file,blob])=>({path:`assets/${id}/${file}`,blob}));
      const asset={id,name:`${model.name} · ${picks.length} 个 2D 动作`,kind:'sprite',source:'工作台序列帧',createdAt:new Date().toISOString(),status:'pending',primaryPath:`assets/${id}/frames.zip`,gifPath:`assets/${id}/animation.gif`,posterPath:`assets/${id}/cover.png`,files:files.map(f=>fileRef(f.path,f.blob)),parentId:model.id,workspaceId,metadata:result.metadata};
      const saved=await saveAsset(asset,files,setProgress);onCatalog(saved.catalog);setSavedFrames(true);onNotify('原始 PNG、图集、GIF 与播放配置已保存到 GitHub');
    }catch(e){setError(e.message);}finally{setBusy(false);setProgress('');}
  }
  function viewChanged(next){setView(next);setResult(null);setSavedFrames(false);}
  const stageModel=assembled?.gltf||value?.gltf;
  return <div className="workbench-page"><div className="page-heading"><div><span className="eyebrow">FROM MODEL TO MOTION TO FRAMES</span><h1>把素材，变成作品。</h1><p>一个模型，一份明确的动作清单，一套属于你的 2D 素材。</p></div><button className="secondary" disabled={busy||!model} onClick={persist}><Save size={16}/>保存工作台</button></div>
    <div className="workspace-settings"><label>工作台名称<input aria-label="工作台名称" placeholder="例如：小雨主角" value={name} onChange={e=>setName(e.target.value)} maxLength={60} disabled={busy}/></label><label>选用模型<select aria-label="选用模型" value={modelId} disabled={busy} onChange={e=>chooseModel(e.target.value)}><option value="">请选择模型</option>{models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>打开已有工作台<select aria-label="打开已有工作台" value={catalog.workspaces.some(w=>w.id===workspaceId)?workspaceId:''} disabled={busy} onChange={e=>chooseWorkspace(e.target.value)}><option value="">新建工作台</option>{catalog.workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label></div>
    {!model?<div className="workbench-empty"><div className="empty-flow"><span><Box size={30}/></span><ArrowRight size={20}/><span><Play size={30}/></span><ArrowRight size={20}/><span><Film size={30}/></span></div><h2>从选用一个模型开始</h2><p>导入你的角色，在资源库确认外观，再来到这里制作。</p><button className="primary" onClick={onUpload}><CloudUpload size={17}/>导入 3D 模型</button></div>:<><div className="production-flow"><section className="flow-node model-node"><div className="node-heading"><span className="node-step">01</span><h2>原始模型</h2><Box size={17}/></div><Stage gltf={value?.gltf} clipIndex={-1}/>{loading&&<div className="node-loading"><LoaderCircle size={16} className="spin"/>读取云端模型…</div>}<div className="node-details"><strong>{model.name}</strong><span>{model.metadata?.boneCount||0} 骨骼 · {(model.metadata?.triangles||0).toLocaleString()} 三角面</span><details><summary>查看来源与版本</summary><p>来源：{model.source||'用户导入'}</p><p>素材标识：{model.id}</p><p>原模型、材质与内嵌贴图均保留。</p></details></div></section>
      <div className="flow-connector"><ArrowRight size={20}/></div><section className="flow-node motion-node"><div className="node-heading"><span className="node-step">02</span><h2>选用动作</h2><Play size={17}/></div>{picks.length?<Stage gltf={assembled?.gltf} clipIndex={playing}/>:<div className="motion-empty"><Play size={34} strokeWidth={1}/><p>让角色动起来</p><span>从库存中选用已有片段</span></div>}{assembling&&<div className="node-loading"><LoaderCircle className="spin" size={16}/>正在核对骨架与组合动作…</div>}<div className="motion-list">{picks.map((m,index)=><div key={motionKey(m)} className={playing===index?'active':''}><button aria-label={`播放 ${m.clip.name}`} disabled={busy||assembling||!!assemblyError} onClick={()=>setPlaying(index)}><Play size={14}/></button><div><strong>{m.clip.name}</strong><small>{m.asset.name} · {m.clip.duration.toFixed(2)}s</small></div><button className="remove-motion" aria-label={`移除选用 ${m.clip.name}`} disabled={busy} onClick={()=>setSelected(selected.filter(p=>motionKey(p)!==motionKey(m)))}><X size={14}/></button></div>)}</div><div className="node-buttons"><button className="secondary full-width" disabled={busy} onClick={()=>setPicker(true)}><Plus size={16}/>选择动作</button><button className="text-button" disabled={busy||!value||assembling||!!assemblyError||(picks.length>0&&!assembled)} onClick={exportModel}><CloudUpload size={15}/>保存选用动作的 GLB</button></div>{assemblyError&&<p className="inline-error">{assemblyError}</p>}</section>
      <div className="flow-connector"><ArrowRight size={20}/></div><section className="flow-node frames-node"><div className="node-heading"><span className="node-step">03</span><h2>2D 序列帧</h2><Film size={17}/></div>{result?<div className="frame-result checkerboard"><img src={gifUrl} alt="当前动作集的 GIF 预览"/><span>{result.metadata.frameCount} 帧 · {size} × {size}</span></div>:<Stage gltf={stageModel} clipIndex={picks.length&&assembled?playing:-1} frameMode onControls={setControls} view={view} onView={viewChanged}/>}
        {!result&&<div className="frame-view-tools"><button aria-label="缩小构图" disabled={!controls||busy} onClick={()=>controls.zoom(1.15)}><ZoomOut size={15}/></button><button aria-label="放大构图" disabled={!controls||busy} onClick={()=>controls.zoom(.87)}><ZoomIn size={15}/></button>{[0,45,90,180].map(angle=><button key={angle} disabled={!controls||busy} onClick={()=>controls.angle(angle)}>{angle}°</button>)}</div>}
        <div className="frame-options"><label>画面尺寸<select aria-label="序列帧尺寸" disabled={busy} value={size} onChange={e=>{setSize(+e.target.value);setResult(null);}}><option value={256}>256 × 256</option><option value={512}>512 × 512</option><option value={1024}>1024 × 1024</option></select></label><label>帧率<select aria-label="序列帧帧率" disabled={busy} value={fps} onChange={e=>{setFps(+e.target.value);setResult(null);}}>{[6,12,24,30].map(f=><option value={f} key={f}>{f} fps</option>)}</select></label></div>
        <div className="node-buttons">{result?<><button className="primary full-width" disabled={busy||savedFrames} onClick={storeFrames}>{savedFrames?<Check size={16}/>:<CloudUpload size={16}/>} {savedFrames?'已保存到 GitHub':'确认并保存云端'}</button><button className="text-button" disabled={busy} onClick={()=>setResult(null)}><RotateCcw size={14}/>重新调整构图</button></>:<button className="primary full-width" disabled={busy||assembling||!assembled||!controls||!!assemblyError} onClick={generate}><Film size={16}/>生成序列帧预览</button>}<small>透明 PNG · 分页图集 · GIF · 整套 ZIP</small></div>
      </section></div><div className="workbench-note"><Check size={16}/><span>生成与保存都不自动下载文件。原素材保留，选用清单决定实际输出。</span></div></>}
    {(error||modelError)&&<p className="page-error" role="alert">{error||modelError}</p>}{progress&&<div className="task-progress" role="status"><LoaderCircle size={17} className="spin"/><span>{progress}</span>{captureAbort.current&&<button onClick={()=>captureAbort.current.abort()}>取消</button>}</div>}
    {picker&&<MotionPicker catalog={catalog} selected={selected} onChange={setSelected} onClose={()=>setPicker(false)}/>}
  </div>;
}
