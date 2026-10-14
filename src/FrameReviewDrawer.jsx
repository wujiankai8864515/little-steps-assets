import React,{useEffect,useRef,useState} from 'react';
import {Clipboard,Layers3,LoaderCircle,Download} from 'lucide-react';
import {Drawer,ProgressBar} from './components/ui.jsx';
import OnionPlayer from './OnionPlayer.jsx';
const verdictNames={usable_with_notes:'可使用，请留意说明',needs_adjustment:'建议调整后再使用',inconclusive:'目前证据不足'};

export default function FrameReviewDrawer({open,onOpenChange,request=null,api,onRefresh,inline=false,onPrepared,initialPlayback,onPlaybackChange}){
 const [result,setResult]=useState(null),[spriteSet,setSpriteSet]=useState(null),[job,setJob]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[details,setDetails]=useState(false),[copied,setCopied]=useState(false);
 const requestKey=JSON.stringify(request),refresh=useRef(onRefresh),prepared=useRef(onPrepared),savedPlayback=useRef(null),saveQueue=useRef(Promise.resolve());refresh.current=onRefresh;prepared.current=onPrepared;
 useEffect(()=>{
  if(!open)return;let gone=false,timer;setResult(null);setSpriteSet(null);setJob(null);setError('');setDetails(false);setCopied(false);
  const url=new URL(location.href),deepReview=request?.reviewId||!request&&url.searchParams.get('review'),deepSet=!request&&url.searchParams.get('spriteSet');
  const body=request||(deepSet?{spriteSetId:deepSet}:null);
  async function accept(r,set){if(gone)return;setResult(r);setSpriteSet(set);savedPlayback.current=set.playback;if(!inline){url.searchParams.delete('review');url.searchParams.set('spriteSet',set.id);if(url.searchParams.get('panel')==='flow')url.searchParams.set('flowModel',set.sourceAssetId);history.replaceState(null,'',url);}prepared.current?.(set);refresh.current?.();}
  async function prepare(retry=false){
   try{
    if(deepReview){const r=await api('frame-reviews/'+deepReview);if(gone)return;const set=await api('sprite-sets',{selections:r.report.actions.map(a=>({assetId:a.assetId,clipIndex:a.clipIndex}))});return accept(r,set);}
    if(!body)throw Error('请先选好模型和动作，再打开洋葱播放。');
    const response=await api(body.workspace&&body.modelId?'workspace/onion':'onion-preview',{...body,...(retry?{retry:true}:{})});if(gone)return;
    if(response.state==='ready')return accept(response.result,response.spriteSet);
    setJob(response.job);if(response.state==='failed')throw Error(response.error);
    async function poll(){try{const j=await api('jobs/'+response.job.id);if(gone)return;setJob(j);if(j.state==='succeeded')await prepare();else if(['queued','running'].includes(j.state))timer=setTimeout(poll,800);else setError(j.error||j.stage);}catch(e){if(!gone)setError(e.message);}}
    timer=setTimeout(poll,700);
   }catch(e){if(!gone)setError(e.message);}
  }
  prepare(attempt>0);return()=>{gone=true;clearTimeout(timer);};
 },[open,requestKey,attempt]);
 useEffect(()=>{if(!open||!details||!result)return;const t=setInterval(()=>api('frame-reviews/'+result.id).then(setResult).catch(()=>{}),4000);return()=>clearInterval(t);},[open,details,result?.id]);
 async function savePlayback(playback){
  savedPlayback.current=playback;
  // Serialize small playlist writes so rapid reorder clicks cannot save backwards.
  const save=saveQueue.current.catch(()=>{}).then(()=>api('sprite-sets/'+spriteSet.id+'/playback',playback));saveQueue.current=save;await save;
 }
 async function copy(){
  const byKey=new Map(spriteSet.actions.map(a=>[a.key,a]));const selections=savedPlayback.current.order.map(k=>{const a=byKey.get(k);return {assetId:a.assetId,clipIndex:a.clipIndex};});
  const text=`请用 asset-workbench 校对 2D 动作集 ${spriteSet.ref}。按用户当前验收播放顺序调用 review-frames：${JSON.stringify({selections,intent:'direct',rootMotionPolicy:'preserve'})}。等待真实任务完成，再读取 review-status，查看原 PNG 证据，保存带 reportHash、证据 ID 和分项 checks 的中文判断。不要把轮廓移动自动当成锚点错误，不改原帧；不足写 not_assessed。`;
  try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setError('复制未成功，请将动作集编号 '+spriteSet.id+' 发给 Codex');}
 }
 const content=<>
  {error&&<div className="review-caution">{error}<button className="text-button" onClick={()=>setAttempt(n=>n+1)}>重试</button></div>}
  {result&&spriteSet?<><a className="button primary full flow-download" href={spriteSet.downloadUrl}><Download size={15}/>下载整套序列帧 · ZIP</a><p className="onion-asset-name">{spriteSet.name}</p><OnionPlayer key={spriteSet.id} result={result} spriteSet={spriteSet} onSavePlayback={savePlayback} initialPlayback={initialPlayback?.setId===spriteSet.id?initialPlayback:null} onPlaybackChange={value=>onPlaybackChange?.({...value,setId:spriteSet.id})}/><details className="onion-details" open={details} onToggle={e=>setDetails(e.currentTarget.open)}><summary>资产文件与详细校对</summary><p className="muted">{spriteSet.name} · 原帧固定画布，位置和根运动保持原样。</p><div className="onion-files">{spriteSet.actions.map(a=><a key={a.key} href={a.downloadUrl}>{a.name} · {a.frames} 帧 · 下载 PNG 包</a>)}</div><div className="review-ai"><h3>{result.decision?verdictNames[result.decision.verdict]:'需要时再请 Codex 看图判断'}</h3>{result.decision&&<p>{result.decision.summary}</p>}<p className="muted">已有结论对应当时的报告顺序。调整播放顺序后，可把当前顺序交给 Codex 重新判断。</p><button className="secondary" onClick={copy}><Clipboard size={14}/>复制当前顺序给 Codex</button>{copied&&<p>已复制，粘贴到 Codex 对话即可。</p>}</div></details></>:<div className="review-empty">{error?<Layers3 size={34}/>:<LoaderCircle className="spin" size={30}/>}<h3>{error?'暂时无法播放':'正在准备所选动作'}</h3><p>{job?.stage||'已有序列帧会直接复用；准备好后自动播放。'}</p>{job&&<ProgressBar value={job.total?job.done/job.total*100:null} label="播放准备进度"/>}</div>}
 </>;
 if(inline)return open?<div className="inline-onion-panel">{content}</div>:null;
 return <Drawer open={open} onOpenChange={onOpenChange} title="2D 动作集 · 洋葱播放" description="同一个模型，一套动作。看位置十字是否稳定，也可以按游戏需要调整播放顺序。" className="frame-review-drawer">{content}</Drawer>;
}
