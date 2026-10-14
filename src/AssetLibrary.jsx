import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Box,Activity,Film,Play,Pause,Download,Search,Plus,LoaderCircle,Pencil,Check,X} from 'lucide-react';
import Viewer from './Viewer.jsx';
import FrameReviewDrawer from './FrameReviewDrawer.jsx';
import {buildMotionCatalog} from '../shared/motion-catalog.mjs';
import {modelLibrary} from '../shared/model-library.mjs';
import {motionName} from './motion-labels.js';
import './asset-library.css';

const coverKey=(a,index)=>a.sha256+':'+index+':1';
export default function AssetLibrary({assets,jobs,covers,libraryId,intent,api,onRefresh,onImportModel,onImportMotion,onUseModel}){
 const storageKey='asset-workbench:'+libraryId+':library';
 const initial=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{return {};}};
 const [kind,setKind]=useState(()=>initial().kind||'模型库'),[query,setQuery]=useState(()=>initial().query||''),[limit,setLimit]=useState(36),[activeKey,setActiveKey]=useState(null),[versionIds,setVersionIds]=useState({}),[frameSet,setFrameSet]=useState(null),[frameIndex,setFrameIndex]=useState(0),[onion,setOnion]=useState(false),[error,setError]=useState('');
 const [createdCovers,setCreatedCovers]=useState({}),[failedCovers,setFailedCovers]=useState(new Set()),saving=useRef(new Set());
 const [renaming,setRenaming]=useState(null),[nameBusy,setNameBusy]=useState(false),[nameError,setNameError]=useState('');
 const byId=useMemo(()=>new Map(assets.map(a=>[a.id,a])),[assets]);
 const models=useMemo(()=>modelLibrary(assets),[assets]);
 const motions=useMemo(()=>[...buildMotionCatalog(assets,jobs,null).variants.values()].map(v=>({key:v.key,asset:v.source,index:v.index,name:v.label,sourceName:v.sourceName,duration:v.duration})),[assets,jobs]);
 const frames=useMemo(()=>{const grouped=new Set(assets.filter(a=>a.kind==='sprite-set').flatMap(a=>a.parents||[]));return assets.filter(a=>(a.kind==='sprite-set'&&!a.supersededBy)||(a.kind==='sprites'&&!grouped.has(a.id))).map(a=>({key:a.id,asset:a,name:a.name,sourceName:byId.get(a.sourceAssetId||a.parents?.[0])?.name||'原帧资产'}));},[assets,byId]);
 const all=kind==='模型库'?models:kind==='动作库'?motions:frames;
 const visible=all.filter(a=>!query||[a.name,a.sourceName,a.asset.source].join(' ').toLowerCase().includes(query.toLowerCase()));
 const active=all.find(a=>a.key===activeKey);
 const coverMap=useMemo(()=>({...Object.fromEntries(covers.map(c=>[c.id,c.file])),...createdCovers}),[covers,createdCovers]);
 useEffect(()=>{if(!intent?.kind)return;setKind(intent.kind);setQuery('');setLimit(36);const items=intent.kind==='模型库'?models:intent.kind==='动作库'?motions:frames;const item=items.find(a=>a.asset.id===intent.assetId&&(intent.clipIndex===undefined||a.index===intent.clipIndex)||a.versions?.some(v=>v.id===intent.assetId));setActiveKey(item?.key||null);},[intent?.nonce]);
 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify({kind,query}));}catch{}},[storageKey,kind,query]);
 useEffect(()=>{setOnion(false);setFrameSet(null);setFrameIndex(0);setError('');if(kind!=='序列帧库')return;if(active?.asset.kind==='sprites'&&!active.asset.previewGif){api('sprite-preview',{assetId:active.asset.id}).catch(e=>setError(e.message));return;}if(active?.asset.kind!=='sprite-set')return;let gone=false;api('sprite-sets/'+active.asset.id).then(r=>{if(!gone)setFrameSet(r);}).catch(e=>{if(!gone)setError(e.message);});return()=>{gone=true;};},[kind,activeKey]);
 function choose(type){setKind(type);setQuery('');setActiveKey(null);setLimit(36);}
 function toggle(key){setActiveKey(v=>v===key?null:key);}
 async function saveName(event){event.preventDefault();setNameBusy(true);setNameError('');try{await api('models/name',{modelId:renaming.key,name:renaming.value});await onRefresh();setRenaming(null);}catch(e){setNameError(e.message);}finally{setNameBusy(false);}}
 const renderCovers=kind==='模型库'?models.filter(m=>!m.asset.thumbnail).map(m=>({...m,index:-1})):kind==='动作库'?motions:[];
 const pending=renderCovers.filter(m=>!coverMap[coverKey(m.asset,m.index)]&&!failedCovers.has(coverKey(m.asset,m.index)));
 // Covers use one small renderer at a time. User playback takes priority.
 const nextCover=!activeKey?pending[0]:null;
 async function saveCover(entry,image){
  const key=coverKey(entry.asset,entry.index);if(saving.current.has(key))return;saving.current.add(key);
  try{const c=await api('asset-covers',{assetId:entry.asset.id,sourceHash:entry.asset.sha256,clipIndex:entry.index,image});setCreatedCovers(v=>({...v,[c.id]:c.file}));}
  catch{setFailedCovers(v=>new Set([...v,key]));}finally{saving.current.delete(key);}
 }
 return <section className="asset-library">
  <div className="asset-library-toolbar"><div className="library-kinds">{[['模型库',models.length,Box],['动作库',motions.length,Activity],['序列帧库',frames.length,Film]].map(([name,count,Icon])=><button key={name} className={kind===name?'active':''} onClick={()=>choose(name)}><Icon size={16}/>{name}<small>{count}</small></button>)}</div><label className="library-search"><Search size={16}/><input value={query} placeholder="搜索名称或来源" aria-label="搜索资产库" onChange={e=>{setQuery(e.target.value);setActiveKey(null);setLimit(36);}}/></label></div>
  <div className="asset-library-grid">{visible.slice(0,limit).map(item=>{
   const selected=activeKey===item.key,model=byId.get(versionIds[item.key])||item.asset,isModel=kind==='模型库',isMotion=kind==='动作库',isFrames=kind==='序列帧库';
   const member=selected&&frameSet?.actions[frameIndex],frameAsset=member?byId.get(member.assetId):item.asset;
   const cover=isFrames?item.asset.thumbnail:coverMap[coverKey(isModel?model:item.asset,isModel?-1:item.index)]||model.thumbnail;
   const download=isFrames&&item.asset.kind==='sprite-set'?'/api/sprite-sets/'+item.asset.id+'/download':'/api/assets/'+model.id+'/download?exact=1';
   return <article key={item.key} className={'library-card '+(selected?'active':'')}>
    <div className="library-card-media">
     {selected&&!isFrames?<Viewer asset={isModel?model:item.asset} clipIndex={isModel?-1:item.index} staticPreview={isModel} hidePlayback={isModel} showClipSelector={false} hideToolbar embedded frameMode/>:selected&&isFrames?<div className="library-card-gif">{!frameAsset?.previewGif&&<span className="library-preview-loading"><LoaderCircle size={16} className="spin"/>正在准备原帧播放…</span>}<img src={'/files/'+(frameAsset?.previewGif||frameAsset?.thumbnail||item.asset.thumbnail)} alt={member?.name||item.name}/></div>:<button className="library-card-cover" aria-label={(isModel?'预览模型：':'播放预览：')+item.name} onClick={()=>toggle(item.key)}>{cover?<img src={'/files/'+cover} alt={item.name+'封面'} loading="lazy"/>:<span className="library-cover-loading"><LoaderCircle size={20} className="spin"/>正在准备封面</span>}<span className="library-cover-play"><Play size={17}/></span></button>}
     {selected&&<button className="library-stop" aria-label={'关闭预览：'+item.name} onClick={()=>toggle(item.key)}><Pause size={12}/>收起预览</button>}
    </div>
    <div className="library-card-body">{isModel&&renaming?.key===item.key?<form className="library-name-form" onSubmit={saveName}><input autoFocus required aria-label="模型新名称" maxLength={60} value={renaming.value} disabled={nameBusy} onChange={e=>setRenaming(v=>({...v,value:e.target.value}))}/><button className="icon-button" type="submit" disabled={nameBusy||!renaming.value.trim()} aria-label="保存模型名称"><Check size={16}/></button><button type="button" className="icon-button" disabled={nameBusy} aria-label="取消改名" onClick={()=>setRenaming(null)}><X size={16}/></button>{nameError&&<p role="alert">{nameError}</p>}</form>:<div className="library-card-title"><strong>{item.name}</strong>{isModel&&<button className="icon-button" aria-label={'修改模型名称：'+item.name} onClick={()=>{setRenaming({key:item.key,value:item.name});setNameError('');}}><Pencil size={13}/></button>}</div>}<small>{isModel?(model.metadata.boneCount?'已绑定骨骼':'需先绑定骨骼')+' · '+item.versions.length+' 个版本':isMotion?item.sourceName+' · '+(item.duration||0).toFixed(1)+' 秒':item.sourceName}</small>
     {selected&&isFrames&&frameSet&&<div className="library-frame-actions">{frameSet.actions.map((a,i)=><button key={a.key} className={i===frameIndex?'active':''} onClick={()=>setFrameIndex(i)}><Play size={11}/>{motionName(a.name)}</button>)}</div>}
     <div className="library-card-actions"><a href={download}><Download size={13}/>{isFrames?'下载 ZIP':'下载'}</a>{isModel&&<button onClick={()=>onUseModel(model)}>用于工作台</button>}{selected&&isFrames&&frameSet&&<button onClick={()=>setOnion(v=>!v)}>{onion?'收起洋葱播放':'洋葱播放'}</button>}</div>
     {isModel&&item.versions.length>1&&<details className="library-versions"><summary>版本记录</summary>{item.versions.map(a=><div className="library-version" key={a.id}><button onClick={()=>{setVersionIds(v=>({...v,[item.key]:a.id}));setActiveKey(item.key);}}><Play size={11}/>{a.name}{a.supersededBy?' · 已修正':''}</button><a href={'/api/assets/'+a.id+'/download?exact=1'} aria-label={'下载 '+a.name}><Download size={12}/></a></div>)}</details>}
    </div>
    {selected&&onion&&frameSet&&<div className="library-card-onion"><FrameReviewDrawer inline open request={{spriteSetId:frameSet.id}} api={api} onRefresh={onRefresh}/></div>}
    {selected&&error&&<p className="flow-error">{error}</p>}
   </article>;
  })}</div>
  {!visible.length&&<p className="muted library-empty">还没有匹配的资产。</p>}
  <div className="library-bottom">{visible.length>limit&&<button className="secondary" onClick={()=>setLimit(v=>v+36)}>显示更多</button>}{kind!=='序列帧库'&&<button className="secondary" onClick={kind==='模型库'?onImportModel:onImportMotion}><Plus size={15}/>{kind==='模型库'?'导入模型':'导入动作'}</button>}<small>{nextCover?'正在补齐封面 · 剩余 '+pending.length+' 张':'点击封面，即可在卡片内预览'}</small></div>
  {nextCover&&<div className="library-cover-renderer" aria-hidden="true"><Viewer asset={nextCover.asset} clipIndex={nextCover.index} embedded frameMode hideToolbar hidePlayback staticPreview poster onPosterReady={png=>saveCover(nextCover,png)} onReady={(ok,message)=>{if(!ok&&message)setFailedCovers(v=>new Set([...v,coverKey(nextCover.asset,nextCover.index)]));}}/></div>}
 </section>;
}
