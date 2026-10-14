import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Activity,ArrowRight,Check,ChevronLeft,ChevronRight,Footprints,Swords,Coffee,Search,X,Play,Pause,RotateCcw,LoaderCircle,Box,Plus} from 'lucide-react';
import Viewer,{playbackTime} from './Viewer.jsx';
import {Segmented} from './components/ui.jsx';
import {buildMotionCatalog} from './motion-catalog.js';

const icons={移动:Footprints,战斗:Swords,日常:Coffee};
const stored=()=>{try{return JSON.parse(localStorage.getItem('wb-motion-variants')||'{}');}catch{return {};}};
function Thumbnail({asset}){return <span className="variant-thumb">{asset.thumbnail?<img alt="" src={'/files/'+asset.thumbnail}/>:<Box size={19}/>}</span>;}

export default function MotionWorkbench({assets,jobs,model,modelPicker,defaultPreview,progress,pending,activeJob,onAssemble,onGetMotions,focusMotion}) {
  const catalog=useMemo(()=>buildMotionCatalog(assets,jobs,model),[assets,jobs,model]);
  const [search,setSearch]=useState(''),[category,setCategory]=useState('推荐'),[groupKey,setGroupKey]=useState(null),[variantKey,setVariantKey]=useState(null);
  const [selectedByModel,setSelectedByModel]=useState(stored),[previewState,setPreviewState]=useState(null),[attempt,setAttempt]=useState(0);
  const [sourceReadyKey,setSourceReadyKey]=useState(null),[targetReadyKey,setTargetReadyKey]=useState(null),[loadError,setLoadError]=useState(null);
  const [playing,setPlaying]=useState(true),[time,setTime]=useState(0);
  const clock=useRef({time:0,stamp:performance.now(),playing:true}),lastSubmitted=useRef(null);
  const variantStrip=useRef(null);
  const group=catalog.groups.find(g=>g.key===groupKey),variant=catalog.variants.get(variantKey);
  const selectedKeys=selectedByModel[model?.id]||[];
  const selected=selectedKeys.map(k=>catalog.variants.get(k)).filter(v=>v&&!v.existing);
  const requestKey=model&&variant?model.id+'|'+variant.key:'';
  const record=previewState?.requestKey===requestKey?previewState.record:null;
  const error=loadError?.key===requestKey?loadError.message:null;
  const sourceReady=sourceReadyKey===variant?.key,targetReady=targetReadyKey===requestKey&&record?.state==='succeeded';
  const duration=record?.duration||variant?.duration||0;
  const done=sourceReady&&targetReady&&!error;
  const filtered=catalog.groups.filter(g=>(category==='推荐'||category==='全部'||g.category===category)&&(!search||(g.label+' '+g.variants.map(v=>v.label+' '+v.raw+' '+v.sourceName).join(' ')).toLowerCase().includes(search.toLowerCase())));
  const visible=category==='推荐'&&!search?filtered.slice(0,12):filtered;
  const recent=catalog.recent.filter(v=>(v.label+' '+v.raw+' '+v.sourceName).toLowerCase().includes(search.toLowerCase()));

  useEffect(()=>{localStorage.setItem('wb-motion-variants',JSON.stringify(selectedByModel));},[selectedByModel]);
  useEffect(()=>{setGroupKey(null);setVariantKey(null);setPreviewState(null);},[model?.id]);
  useEffect(()=>{
    if(!focusMotion)return;
    const v=[...catalog.variants.values()].find(v=>v.assetId===focusMotion.assetId);
    if(v){setSearch('');setCategory('最近');setGroupKey(v.group);setVariantKey(v.key);setAttempt(0);}
  },[focusMotion?.nonce]);
  useEffect(()=>{
    if(activeJob?.id===lastSubmitted.current&&activeJob.state==='succeeded'){
      setSelectedByModel(v=>({...v,[model.id]:[]}));setGroupKey(null);setVariantKey(null);lastSubmitted.current=null;
    }
  },[activeJob?.id,activeJob?.state]);
  useEffect(()=>{
    if(!requestKey)return;
    let stale=false,timer;const controller=new AbortController();
    setPreviewState({requestKey,record:{state:'queued',stage:'正在准备试播'}});setLoadError(null);
    clock.current={time:0,stamp:performance.now(),playing:true};setPlaying(true);setTime(0);
    async function fetchRecord(url,body){const r=await fetch(url,{signal:controller.signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const result=await r.json();if(!r.ok)throw Error(result.error||'试播准备失败');return result;}
    async function receive(result){
      if(stale)return;setPreviewState({requestKey,record:result});
      if(['queued','running'].includes(result.state))timer=setTimeout(async()=>{try{await receive(await fetchRecord('/api/motion-previews/'+result.id));}catch(e){fail(e);}},400);
    }
    function fail(e){if(stale||e.name==='AbortError')return;setLoadError({key:requestKey,message:e.message});}
    fetchRecord('/api/motion-preview',{modelId:model.id,assetId:variant.assetId,index:variant.index,retry:attempt>0}).then(receive).catch(fail);
    return()=>{stale=true;clearTimeout(timer);controller.abort();};
  },[requestKey,attempt]);
  useEffect(()=>{if(done){const play=clock.current.playing,start=play?0:clock.current.time;clock.current={time:start,stamp:performance.now(),playing:play};setPlaying(play);setTime(start);}},[done,requestKey]);
  useEffect(()=>{if(!variant)return;const timer=setInterval(()=>setTime(playbackTime(clock.current,duration)),120);return()=>clearInterval(timer);},[variant?.key,duration]);
  useEffect(()=>{const el=variantStrip.current,button=el?.querySelector('[aria-pressed="true"]');if(el&&button)el.scrollTo({left:button.offsetLeft-el.clientWidth/2+button.clientWidth/2,behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});},[variant?.key]);

  function chooseGroup(g){
    setGroupKey(g.key);
    const pick=g.variants.find(v=>selectedKeys.includes(v.key))||g.variants.find(v=>!v.existing)||g.variants[0];
    setVariantKey(pick.key);setAttempt(0);
    if(window.matchMedia('(max-width:740px)').matches)requestAnimationFrame(()=>document.querySelector('.motion-compare')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'}));
  }
  function chooseVariant(v){setVariantKey(v.key);setAttempt(0);}
  function stepVariant(delta){const i=group.variants.findIndex(v=>v.key===variant.key);chooseVariant(group.variants[(i+delta+group.variants.length)%group.variants.length]);}
  function toggle(v){setSelectedByModel(all=>{const keys=all[model.id]||[];return {...all,[model.id]:keys.includes(v.key)?keys.filter(k=>k!==v.key):[...keys,v.key]};});}
  function seek(value){clock.current={time:value,stamp:performance.now(),playing:clock.current.playing};setTime(value);}
  function pause(){const next=!clock.current.playing;clock.current={time:playbackTime(clock.current,duration),stamp:performance.now(),playing:next};setPlaying(next);}
  async function assemble(){const j=await onAssemble(selected.map(v=>({assetId:v.assetId,index:v.index,name:v.label+' · '+v.sourceName})));if(j){lastSubmitted.current=j.id;setGroupKey(null);setVariantKey(null);}}
  const previewError=error||(['failed','needs_input','interrupted'].includes(record?.state)?record.error||record.stage:null);

  return <div className="work-layout motion-workbench"><section className="form-panel">
    <div className="form-section"><div className="step-label"><span className="step-number">01</span><h2>选择模型</h2></div>{modelPicker}</div>
    <div className="form-section motions-section"><div className="step-label"><span className="step-number">02</span><h2>挑选动作</h2><span className="step-aside">先看效果，再选用</span></div>
      <button className="get-mixamo-motions" onClick={onGetMotions}><Plus size={16}/><span>去 Mixamo 获取新动作</span><ArrowRight size={15}/></button>
      {catalog.recent[0]&&<button className="recent-import-entry" disabled={!model||pending} onClick={()=>{const v=catalog.recent[0];setCategory('最近');setGroupKey(v.group);chooseVariant(v);}}><span><small>最近导入</small><strong>{catalog.recent[0].label} <em>· {catalog.recent[0].sourceName}</em></strong></span><Play size={14}/></button>}
      <div className="search-field"><Search size={16}/><input aria-label="搜索动作" value={search} placeholder="搜索行走、拳击、跳跃…" onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="清空搜索" onClick={()=>setSearch('')}><X size={14}/></button>}</div>
      <Segmented value={category} onChange={setCategory} items={['推荐','最近','移动','战斗','全部']} label="动作分类"/>
      {category==='最近'?<div className="recent-motion-list">{recent.map(v=><button key={v.key} disabled={!model||pending} className={variantKey===v.key?'active':''} onClick={()=>{setGroupKey(v.group);chooseVariant(v);}}><Thumbnail asset={v.source}/><span><strong>{v.label}</strong><small>{v.sourceName} · {v.duration.toFixed(1)} 秒</small></span>{v.existing?<Check size={14}/>:<Play size={14}/>}</button>)}{!recent.length&&<p className="empty-state">导入的动作会出现在这里。</p>}</div>:<div className="motion-grid">{visible.map(g=>{const Icon=icons[g.category]||Activity,count=g.variants.filter(v=>selectedKeys.includes(v.key)&&!v.existing).length,sources=new Set(g.variants.map(v=>v.assetId)).size;return <button className={'motion-card motion-group '+(groupKey===g.key?'inspecting ':'')+(count?'chosen':'')} key={g.key} onClick={()=>chooseGroup(g)} disabled={!model||pending} aria-label={'预览'+g.label} aria-pressed={groupKey===g.key}>
        <span className={'motion-icon cat-'+g.category}><Icon size={18} strokeWidth={1.6}/></span><span className="motion-check">{count?<Check size={12}/>:<Play size={11}/>}</span><strong>{g.label}</strong><small>{count?'已选 '+count+' 个版本':sources+' 个来源 · '+g.variants.length+' 个版本'}</small>
      </button>;})}{!visible.length&&<div className="empty-state"><Search size={26}/><p>没有找到这个动作</p><button className="text-button" onClick={onGetMotions}>去获取这个动作</button></div>}</div>}
      {category!=='最近'&&visible.length<filtered.length&&<button className="show-more" onClick={()=>setCategory('全部')}>查看全部动作 <ArrowRight size={13}/></button>}
    </div>
    {selected.length>0&&<div className="selected-motion-list"><div><strong>已选 {selected.length} 个动作</strong><button onClick={()=>setSelectedByModel(s=>({...s,[model.id]:[]}))} disabled={pending}>清空</button></div>{selected.map(v=><div className="selected-motion" key={v.key}><button onClick={()=>{setGroupKey(v.group);chooseVariant(v);}}><span>{v.label}</span><small>{v.sourceName}</small></button><button className="icon-button" aria-label={'移除'+v.label+' '+v.sourceName} disabled={pending} onClick={()=>toggle(v)}><X size={13}/></button></div>)}</div>}
    <div className="form-action"><button className="primary full" disabled={!model||!selected.length||pending} onClick={assemble}>{pending?<><LoaderCircle size={17} className="spin"/>正在制作</>:<>打包{selected.length?' '+selected.length+' 个':''}动作 <ArrowRight size={17}/></>}</button><p className="action-note">{selected.length?'使用刚才试播的版本，保留模型已有动作。':'点击一个动作，先看看用在你模型上的效果。'}</p>{progress}</div>
  </section>
  {group&&variant?<section className="motion-compare preview-panel" aria-label="动作来源对比">
    <header className="compare-heading"><div><button className="icon-button" aria-label="返回模型预览" onClick={()=>{setGroupKey(null);setVariantKey(null);}}><ChevronLeft size={18}/></button><h2>{group.label}</h2><span>打包前试播</span></div><div className="variant-pagination" role="group" aria-label="切换动作版本"><button className="icon-button" aria-label="上一个动作版本" onClick={()=>stepVariant(-1)} disabled={group.variants.length<2}><ChevronLeft size={16}/></button><span>{group.variants.findIndex(v=>v.key===variant.key)+1} / {group.variants.length}</span><button className="icon-button" aria-label="下一个动作版本" onClick={()=>stepVariant(1)} disabled={group.variants.length<2}><ChevronRight size={16}/></button></div></header>
    <div className="variant-strip" ref={variantStrip} role="group" aria-label="选择动作来源">{group.variants.map(v=><button key={v.key} className={'variant-option '+(v.key===variant.key?'active':'')} aria-pressed={v.key===variant.key} aria-label={v.sourceName+'，'+v.label} onClick={()=>chooseVariant(v)}><Thumbnail asset={v.source}/><div><strong>{v.sourceName}</strong><span>{v.label} · {v.duration.toFixed(1)} 秒</span></div>{v.existing?<span className="variant-status">已有</span>:selectedKeys.includes(v.key)?<Check size={14}/>:null}</button>)}</div>
    <div className="comparison-viewers">
      <div className="compare-view source-view"><div className="compare-view-title"><span>原模型的动作</span><small>{variant.sourceName}</small></div><Viewer asset={variant.source} clipIndex={variant.index} hidePlayback reloadKey={attempt} syncPlayback={clock} onReady={(ok,message)=>{setSourceReadyKey(ok?variant.key:null);if(message)setLoadError({key:requestKey,message});}}/>{!variant.source.metadata.vertices&&<span className="skeleton-only-note">这个来源只包含骨架动作</span>}</div>
      <div className="compare-view target-view"><div className="compare-view-title"><span>用在你的模型上</span><small>{model.name}</small></div><Viewer asset={model} clipIndex={0} hidePlayback reloadKey={attempt} syncPlayback={clock} animationPreview={record?.state==='succeeded'?record:null} onReady={(ok,message)=>{if(message)setLoadError({key:requestKey,message});}} onPreviewReady={(ok,message)=>{setTargetReadyKey(ok?requestKey:null);if(message)setLoadError({key:requestKey,message});}}/>{(!targetReady||previewError)&&<div className="comparison-loading" role="status">{previewError?<><span>这个版本暂时无法试播</span><details><summary>查看原因</summary><p>{previewError}</p></details>{!model.metadata.boneCount?<button className="secondary compact" onClick={onGetMotions}>为角色绑定骨架</button>:record?.state==='needs_input'?<button className="secondary compact" onClick={()=>stepVariant(1)}>换一个动作来源</button>:<button className="secondary compact" onClick={()=>{setLoadError(null);setAttempt(v=>v+1);}}>重新试播</button>}</>:<><LoaderCircle size={21} className="spin"/><span>{record?.state==='succeeded'?'正在载入动作':record?.stage||'正在准备试播'}</span><small>原模型可以先看，准备好后会同步播放。</small></>}</div>}</div>
    </div>
    <div className="compare-transport"><button className="play-toggle" aria-label={playing?'暂停对比':'播放对比'} onClick={pause}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><button className="icon-button" aria-label="从头播放对比" onClick={()=>seek(0)}><RotateCcw size={15}/></button><input type="range" min="0" max={duration||1} step="0.01" value={Math.min(time,duration)} aria-label="对比播放进度" onChange={e=>seek(+e.target.value)}/><span>{time.toFixed(1)} / {duration.toFixed(1)} 秒</span><small>{done?'同步播放':'原模型播放'}</small></div>
    <footer className="compare-decision"><div><strong>{variant.label}</strong><span>{variant.sourceName}{variant.existing?' · 当前模型已有这个版本':''}</span></div><button className={'primary '+(selectedKeys.includes(variant.key)?'chosen-variant':'')} disabled={!done||variant.existing||pending} onClick={()=>toggle(variant)}>{variant.existing?<><Check size={16}/>模型已有</>:selectedKeys.includes(variant.key)?<><Check size={16}/>已选用，点击取消</>:<><Plus size={16}/>选用这个版本</>}</button></footer>
  </section>:defaultPreview}
  </div>;
}
