import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Play,Pause,RotateCcw,ChevronLeft,ChevronRight,Plus,Trash2,GripVertical} from 'lucide-react';
import {SelectField} from './components/ui.jsx';
import {motionName} from './motion-labels.js';

function imageCache(){
 const entries=new Map();let closed=false;
 return {load(url){
  if(entries.has(url)){const e=entries.get(url);entries.delete(url);entries.set(url,e);return e.promise;}
  const image=new Image();image.decoding='async';
  const entry={image,promise:new Promise((resolve,reject)=>{image.onload=()=>closed?reject(Error('closed')):resolve(image);image.onerror=()=>reject(Error('图片未能载入，请重新打开播放窗口'));image.src=url;})};
  entries.set(url,entry);while(entries.size>80)entries.delete(entries.keys().next().value);
  return entry.promise;
 },close(){closed=true;entries.clear();}};
}

export default function OnionPlayer({result,spriteSet,onSavePlayback,initialPlayback,onPlaybackChange}){
 const actions=result.report.actions,byKey=useMemo(()=>new Map(actions.map(a=>[a.assetId+':'+a.clipIndex,a])),[result.id]);
 const defaults=actions.map(a=>a.assetId+':'+a.clipIndex);
 const initial=spriteSet?.playback?.order?.filter(k=>byKey.has(k));
 const [order,setOrder]=useState(initial?.length?initial:defaults),[repeat,setRepeat]=useState(spriteSet?.playback?.repeat!==false);
 const [index,setIndex]=useState(initialPlayback?.index||0),[playing,setPlaying]=useState(initialPlayback?.playing!==false),[speed,setSpeed]=useState(initialPlayback?.speed||.5),[onion,setOnion]=useState(initialPlayback?.onion!==false),[editing,setEditing]=useState(false),[addKey,setAddKey]=useState(defaults[0]);
 const [error,setError]=useState(''),[saving,setSaving]=useState('');
 const canvas=useRef(),cache=useRef(),painted=useRef(-1),clock=useRef({elapsed:0,stamp:null}),cursor=useRef(0),saveVersion=useRef(0),dragIndex=useRef(null),firstTimeline=useRef(true),playbackCallback=useRef(onPlaybackChange),playbackState=useRef();
 playbackCallback.current=onPlaybackChange;playbackState.current={index,playing,speed,onion};
 const timeline=useMemo(()=>{
  const frames=[];let time=0;
  order.forEach((key,position)=>{const action=byKey.get(key);if(!action)return;action.frames.forEach((frame,fi)=>{const delta=action.frames[fi+1]?.time-frame.time,duration=delta>0&&Number.isFinite(delta)?delta:1/(action.fps||24);frames.push({action,position,frame,localIndex:fi,start:time,duration});time+=duration;});});
  return {frames,duration:time};
 },[order,byKey]);
 const current=timeline.frames[index]||timeline.frames[0],total=timeline.frames.length;
 const timing=useRef();timing.current={playing,speed,repeat,timeline};cursor.current=index;
 useEffect(()=>{const c=imageCache();cache.current=c;return()=>{c.close();cache.current=null;};},[result.id]);
 useEffect(()=>{const start=firstTimeline.current?Math.min(initialPlayback?.index||0,Math.max(0,timeline.frames.length-1)):0;firstTimeline.current=false;cursor.current=start;setIndex(start);painted.current=-1;clock.current={elapsed:0,stamp:null};},[timeline]);
 useEffect(()=>{const save=()=>playbackCallback.current?.(playbackState.current);const timer=setInterval(save,2000);addEventListener('pagehide',save);document.addEventListener('visibilitychange',save);return()=>{save();clearInterval(timer);removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',save);};},[]);
 useEffect(()=>{playbackCallback.current?.(playbackState.current);},[playing,speed,onion]);
 useEffect(()=>{
  let raf,stopped=false;
  function tick(stamp){
   if(stopped)return;raf=requestAnimationFrame(tick);
   const state=timing.current,dt=clock.current.stamp===null?0:Math.min((stamp-clock.current.stamp)/1000,.1);clock.current.stamp=stamp;
   if(!state.playing||document.hidden||painted.current!==cursor.current)return;
   clock.current.elapsed+=dt*state.speed;
   if(clock.current.elapsed>=state.timeline.frames[cursor.current].duration){
    clock.current.elapsed-=state.timeline.frames[cursor.current].duration;
    if(cursor.current===state.timeline.frames.length-1&&!state.repeat){clock.current.elapsed=0;setPlaying(false);return;}
    cursor.current=(cursor.current+1)%state.timeline.frames.length;painted.current=-1;setIndex(cursor.current);
   }
  }
  raf=requestAnimationFrame(tick);return()=>{stopped=true;cancelAnimationFrame(raf);};
 },[result.id]);
 useEffect(()=>{
  if(!canvas.current||!current||!cache.current)return;let gone=false;
  const frameAt=n=>timeline.frames[repeat?(n+total)%total:Math.min(total-1,Math.max(0,n))];
  const imageFor=f=>cache.current.load(result.baseUrl+f.frame.file);
  const offsets=onion?[-2,2,-1,1,0]:[0];
  Promise.all(offsets.map(n=>imageFor(frameAt(index+n)))).then(images=>{
   if(gone||!canvas.current)return;
   const ctx=canvas.current.getContext('2d'),layer=canvas.current._ghostLayer||(canvas.current._ghostLayer=document.createElement('canvas'));
   layer.width=layer.height=512;const tint=layer.getContext('2d');ctx.clearRect(0,0,512,512);
   images.forEach((image,i)=>{const offset=offsets[i];
    if(offset){tint.clearRect(0,0,512,512);tint.globalCompositeOperation='source-over';tint.drawImage(image,0,0,512,512);tint.globalCompositeOperation='source-in';tint.fillStyle=offset<0?'#0895af':'#ed8a40';tint.fillRect(0,0,512,512);ctx.globalAlpha=Math.abs(offset)===2?.16:.32;ctx.drawImage(layer,0,0);}
    else{ctx.globalAlpha=1;ctx.drawImage(image,0,0,512,512);}
   });
   ctx.globalAlpha=1;
   if(current.frame.pivot){const [x,y]=current.frame.pivot.map(v=>v*512);ctx.strokeStyle='#204f40';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x+10,y);ctx.moveTo(x,y-10);ctx.lineTo(x,y+10);ctx.stroke();ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.stroke();}
   painted.current=index;setError('');
  }).catch(e=>{if(!gone){setError(e.message);setPlaying(false);}});
  for(let n=3;n<15;n++)imageFor(frameAt(index+n)).catch(()=>{});
  return()=>{gone=true;};
 },[index,onion,repeat,timeline,result.id]);
 function seek(n){setPlaying(false);cursor.current=n;setIndex(n);painted.current=-1;clock.current={elapsed:0,stamp:null};}
 function startAt(position){const n=timeline.frames.findIndex(f=>f.position===position);if(n>=0){seek(n);setPlaying(true);}}
 async function persist(nextOrder,nextRepeat=repeat){
  setOrder(nextOrder);setRepeat(nextRepeat);const version=++saveVersion.current;setSaving('正在保存');
  try{await onSavePlayback({order:nextOrder,repeat:nextRepeat});if(version===saveVersion.current)setSaving('播放顺序已保存');}catch(e){if(version===saveVersion.current)setSaving('保存未完成：'+e.message);}
 }
 function move(from,to){if(to<0||to>=order.length||from===to)return;const next=[...order],item=next.splice(from,1)[0];next.splice(to,0,item);persist(next);}
 const seconds=value=>value.toFixed(1)+'s';
 return <div className="onion-player">
  <div className="onion-playlist-heading"><span><strong>{order.length} 段动作</strong> · 按此顺序播放</span><button className="text-button" onClick={()=>setEditing(v=>!v)}>{editing?'收起顺序编辑':'调整播放顺序'}</button></div>
  <div className="onion-playlist" aria-label="动作播放顺序">{order.map((key,i)=><button key={i+key} draggable onDragStart={()=>dragIndex.current=i} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragIndex.current!==null)move(dragIndex.current,i);dragIndex.current=null;}} onDragEnd={()=>dragIndex.current=null} className={current?.position===i?'active':''} aria-current={current?.position===i?'step':undefined} aria-label={'播放序列帧：'+motionName(byKey.get(key)?.label)+' · 第 '+(i+1)+' 段'} onClick={()=>startAt(i)}><Play size={13}/><span>{i+1}</span>{motionName(byKey.get(key)?.label)}</button>)}</div>
  {editing&&<div className="onion-order-editor">{order.map((key,i)=><div key={i+key}><GripVertical size={14}/><span>{i+1}. {motionName(byKey.get(key)?.label)}</span><button className="icon-button" disabled={i===0} onClick={()=>move(i,i-1)} aria-label={'第 '+(i+1)+' 段前移'}><ChevronLeft size={16}/></button><button className="icon-button" disabled={i===order.length-1} onClick={()=>move(i,i+1)} aria-label={'第 '+(i+1)+' 段后移'}><ChevronRight size={16}/></button><button className="icon-button" disabled={order.length===1} onClick={()=>persist(order.filter((_,n)=>n!==i))} aria-label={'移除第 '+(i+1)+' 段播放'}><Trash2 size={14}/></button></div>)}<div><SelectField label="再加入一段动作" value={addKey} onChange={setAddKey} options={actions.map(a=>({value:a.assetId+':'+a.clipIndex,label:motionName(a.label)}))}/><button className="secondary compact" disabled={order.length>=30} onClick={()=>persist([...order,addKey])}><Plus size={14}/>加入</button></div><small>只调整验收播放，可重复加入动作；不会删除资产。</small></div>}
  <div className="onion-stage"><canvas ref={canvas} width="512" height="512" aria-label="同一模型多动作洋葱播放"/><div className="onion-now"><span className={playing?'onion-playing':''}/>{motionName(current?.action.label)}<small>第 {(current?.localIndex||0)+1} / {current?.action.frames.length||0} 帧</small></div></div>
  <div className="onion-legend"><span className="before">前两帧</span><span>当前原帧</span><span className="after">后两帧</span><span>＋ 位置锚点</span></div>
  <input className="onion-timeline" type="range" aria-label="播放进度" min="0" max={Math.max(0,total-1)} value={Math.min(index,total-1)} onChange={e=>seek(+e.target.value)}/>
  <div className="onion-controls"><button className="primary" onClick={()=>{if(!playing&&index===total-1&&!repeat)seek(0);setPlaying(v=>!v);}}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'暂停':'播放'}</button><button className="icon-button" aria-label="从头播放" onClick={()=>{seek(0);setPlaying(true);}}><RotateCcw size={17}/></button><span className="onion-time">{seconds(current?.start||0)} / {seconds(timeline.duration)}</span><SelectField label="播放速度" value={speed} onChange={v=>setSpeed(+v)} options={[{value:.25,label:'¼ 倍速'},{value:.5,label:'½ 倍速'},{value:1,label:'正常速度'}]}/></div>
  <div className="onion-options"><label><input type="checkbox" checked={onion} onChange={e=>setOnion(e.target.checked)}/>洋葱皮</label><label><input type="checkbox" checked={repeat} onChange={e=>persist(order,e.target.checked)}/>循环整套动作</label><small>{saving}</small></div>
  {error&&<p className="flow-error">{error}</p>}
 </div>;
}
