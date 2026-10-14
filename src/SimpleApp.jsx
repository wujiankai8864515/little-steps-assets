import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Box,Boxes,Sparkles,Plus,Download,X,Check,Upload,Clipboard,Settings2,Layers3,LoaderCircle,ImagePlus,ChevronRight,Monitor,GitBranch,ArrowRight,Activity} from 'lucide-react';
import AssetFlow from './AssetFlow.jsx';
import AssetLibrary from './AssetLibrary.jsx';
import GenerationForm from './GenerationForm.jsx';
import ModelImportForm from './ModelImportForm.jsx';
import {useGenerationMemory} from './generation-memory.js';
import CapturePage from './CapturePage.jsx';
import {isCharacter} from '../shared/asset-roles.mjs';
import {SelectField,Segmented,ProgressBar,Drawer,TooltipProvider} from './components/ui.jsx';
import {motionName,rawMotionName} from './motion-labels.js';
import './studio.css';
import './motion-preview.css';
import './production-flows.css';
import './frame-review.css';

async function api(route,body){
 const r=await fetch('/api/'+route,body?{method:'POST',...(body instanceof FormData?{body}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}:{});
 const value=await r.json();if(!r.ok)throw Error(value.error||'没有完成，请稍后再试');return value;
}
const pages={flow:{name:'工作台',title:'一个模型，接着做完。',intro:'预览、挑选动作和制作序列帧，都在框内完成。',icon:GitBranch},library:{name:'资产库',title:'积累的资产，随时可用。',intro:'模型、动作、序列帧，点击卡片直接预览。',icon:Boxes},generate:{name:'生成模型',title:'把想法，变成模型。',intro:'一句描述，或同一模型的多张视角图片。',icon:Sparkles}};
const running=j=>['queued','running'].includes(j?.state);
function Thumb({asset}){return <span className="asset-thumb">{asset?.thumbnail?<img src={'/files/'+asset.thumbnail} alt="" loading="lazy"/>:<Box size={27} strokeWidth={1.3}/>}</span>;}

function App(){
 const params=new URLSearchParams(location.search);
 const [state,setState]=useState({assets:[],jobs:[],workspace:{models:[]}}),[page,setPage]=useState(()=>['library','generate'].includes(params.get('panel'))?params.get('panel'):'flow');
 const [intent,setIntent]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[connected,setConnected]=useState(true),[manage,setManage]=useState(false);
 const [libraryIntent,setLibraryIntent]=useState(null);
 const [quote,setQuote]=useState(null),[jobId,setJobId]=useState(null),[modelImportFiles,setModelImportFiles]=useState([]);
 const generation=useGenerationMemory(api,state.libraryId,state.generationDraft),{modelName,prompt,references}=generation.draft;
 const generationSpec=useRef();generationSpec.current=JSON.stringify({modelName,prompt,references});
 const refreshSequence=useRef(0);
 const folderInput=useRef(),motionInput=useRef(),fileInput=useRef(),referenceInput=useRef(),motionImportJobs=useRef(new Map()),initialAsset=useRef(params.get('asset'));
 const assets=state.assets,activeJob=state.jobs.find(j=>j.id===jobId),activeGenerationJob=activeJob?.type==='generate'?activeJob:state.jobs.find(j=>j.id===state.generationDraft?.lastJobId);
 const referenceCards=references.map(r=>{const j=state.jobs.find(j=>j.id===r.jobId);return {...r,asset:assets.find(a=>a.id===(r.assetId||j?.outputs?.[0])),failed:['failed','cancelled','needs_input','interrupted'].includes(j?.state)};});
 const imageIds=referenceCards.map(r=>r.asset?.id).filter(Boolean);
 const activeModel=assets.find(a=>a.id===state.workspace?.activeModelId);
 async function refresh(){const sequence=++refreshSequence.current;try{const next=await api('state');if(sequence!==refreshSequence.current)return;setState(previous=>{const merged={...next};let changed=false;for(const key of Object.keys(next)){if(Array.isArray(next[key])){const byId=new Map((previous[key]||[]).map(v=>[v.id,v]));merged[key]=next[key].map(v=>JSON.stringify(byId.get(v.id))===JSON.stringify(v)?byId.get(v.id):v);if(merged[key].length===previous[key]?.length&&merged[key].every((v,i)=>v===previous[key][i]))merged[key]=previous[key];}else if(JSON.stringify(next[key])===JSON.stringify(previous[key]))merged[key]=previous[key];if(merged[key]!==previous[key])changed=true;}return changed?merged:previous;});setConnected(true);}catch{if(sequence===refreshSequence.current)setConnected(false);}}
 useEffect(()=>{refresh();const timer=setInterval(()=>{if(!document.hidden)refresh();},1600);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),6500);return()=>clearTimeout(t);},[notice]);
 useEffect(()=>{if(initialAsset.current){const a=assets.find(a=>a.id===initialAsset.current);if(a){initialAsset.current=null;if(page==='library')setLibraryIntent({kind:a.kind==='sprites'||a.kind==='sprite-set'?'序列帧库':a.kind==='motion'||a.usageRole==='motion-source'?'动作库':'模型库',assetId:a.id,...(params.has('clip')?{clipIndex:Number(params.get('clip'))}:{}),nonce:Date.now()});else openAsset(a);}}},[assets.length]);
 useEffect(()=>{for(const [id,originPage] of motionImportJobs.current){const j=state.jobs.find(j=>j.id===id);if(j?.state==='succeeded'){motionImportJobs.current.delete(id);if(originPage==='library'){setPage('library');setLibraryIntent({kind:'动作库',nonce:Date.now()});}else{setPage('flow');setIntent({sourceAssetId:j.outputs[0],nonce:Date.now()});}setNotice('动作已进入动作库，可直接预览。');}}},[state.jobs]);
 async function run(fn){setBusy(true);try{return await fn();}catch(e){setNotice(e.message);}finally{setBusy(false);}}
 function navigate(next){setPage(next);const u=new URL(location.href);u.searchParams.set('panel',next);u.searchParams.delete('asset');history.replaceState(null,'',u);}
 function flowNavigate(kind){if(kind==='import-motion'){motionInput.current.click();return;}navigate(kind==='generate'?'generate':'flow');}
 function openAsset(a){
  setManage(false);setPage('flow');let next={nonce:Date.now()};
  if(a.model)next={...next,modelId:a.model.id,clipIndex:a.actionIndex};
  else if(a.kind==='sprite-set')next={...next,modelId:a.sourceAssetId,spriteSetId:a.id};
  else if(a.usageRole==='motion-source')next={...next,sourceAssetId:a.id};
  else if(a.kind==='model')next={...next,modelId:a.id};
  else if(a.kind==='review'){const u=new URL(location.href);u.search='?panel=flow&review='+a.id;location.assign(u);return;}
  else{setNotice('这份文件可在制作记录中下载；请选择模型或动作集继续。');return;}
  const u=new URL(location.href);u.searchParams.set('panel','flow');u.searchParams.delete('asset');u.searchParams.delete('review');u.searchParams.delete('spriteSet');if(next.modelId)u.searchParams.set('flowModel',next.modelId);if(next.spriteSetId)u.searchParams.set('spriteSet',next.spriteSetId);history.replaceState(null,'',u);setIntent(next);
 }
 async function importFiles(files,kind='model'){
  if(!files.length)return;
  if(kind==='model'){setManage(false);setModelImportFiles(files);for(const input of [fileInput,folderInput])if(input.current)input.current.value='';return;}
  if(kind==='reference'&&(files.some(f=>!(/\.(png|jpe?g|webp)$/i.test(f.name)))||generation.read().references.length+files.length>32)){setNotice('请选择 PNG、JPG 或 WebP；参考图总数最多 32 张。');return;}
  await run(async()=>{
   const independent=files.length>1&&files.every(f=>/\.(fbx|bvh|glb)$/i.test(f.name)),batches=independent||kind==='reference'?files.map(f=>[f]):[files];
   for(const batch of batches){const form=new FormData();for(const f of batch)form.append('files',f,f.webkitRelativePath||f.name);if(kind!=='reference')form.append('usageRole',kind==='motion'?'motion-source':'character');if(kind==='motion')form.append('source','用户导入的动作');const j=await api('import',form);
    if(kind==='reference'){generation.update({references:[...generation.read().references,{key:j.id,jobId:j.id,name:batch[0].name}]});setQuote(null);}else{setJobId(j.id);if(kind==='motion')motionImportJobs.current.set(j.id,page);}
   }
   await refresh();if(kind==='model'){navigate('library');setLibraryIntent({kind:'模型库',nonce:Date.now()});}if(kind!=='reference')setNotice('文件正在整理，完成后可在资产库直接预览。');
  });
  for(const input of [fileInput,motionInput,folderInput,referenceInput])if(input.current)input.current.value='';
 }
 async function getQuote(){await run(async()=>{if(!modelName.trim())throw Error('请先填写模型名称');if(references.length&&imageIds.length!==references.length)throw Error('请等待全部参考图导入完成');await generation.flush();const spec=generationSpec.current,result=await api('quote',{name:modelName.trim(),operation:imageIds.length?'image-to-3d':'text-to-3d',prompt,version:'G1',faceCount:100000,imageIds});if(generationSpec.current===spec)setQuote({...result,spec});});}
 async function submit(){await run(async()=>{if(quote.spec!==generationSpec.current){setQuote(null);throw Error('名称、参考图或描述已改变，请重新查看费用');}const j=await api('submit',{quoteId:quote.id,confirmCredits:quote.credits});setJobId(j.id);setQuote(null);await refresh();});}
 async function copyJob(j){try{await navigator.clipboard.writeText('请用 asset-workbench skill 继续任务 '+j.id+'。先读取工作台选用范围，只处理我指定的模型和动作。其他候选先在工作台预览，不能自动加入；保留面部、贴图与原文件。');setNotice('已复制，粘贴到 Codex 对话即可继续。');}catch{setNotice('请把任务编号 '+j.id+' 发给 Codex。');}}
 function progress(j=activeJob){
  if(!j)return null;return <div className="job-progress" aria-live="polite"><div className="progress-heading">{running(j)&&<LoaderCircle size={16} className="spin"/>}<strong>{j.state==='succeeded'?'文件已准备好':j.stage}</strong></div>{running(j)&&<ProgressBar value={j.total?j.done/j.total*100:null} label="制作进度"/>}{j.error&&<p>{j.error}</p>}{j.outputs?.map(id=>{const a=assets.find(v=>v.id===id);return a?<button key={id} className="secondary full" onClick={()=>{navigate('library');setLibraryIntent({kind:a.kind==='model'?'模型库':a.kind==='sprites'||a.kind==='sprite-set'?'序列帧库':'动作库',assetId:a.id,nonce:Date.now()});}}>在资产卡片中预览 <ArrowRight size={14}/></button>:null;})}{['needs_input','interrupted','failed'].includes(j.state)&&<button className="text-button" onClick={()=>copyJob(j)}>交给 Codex 继续 <Clipboard size={13}/></button>}</div>;
 }
 return <TooltipProvider delayDuration={350}><div className="studio-app">
  <aside className="sidebar"><a className="brand" href="?panel=flow" onClick={e=>{e.preventDefault();navigate('flow');}}><span className="brand-mark"><Box size={23} strokeWidth={1.5}/></span><span>资产工坊<small>ASSET STUDIO</small></span></a><div className="nav-caption">创作空间</div>
   <nav aria-label="主要功能">{Object.entries(pages).map(([key,p])=>{const Icon=p.icon;return <button key={key} className={page===key?'selected':''} aria-current={page===key?'page':undefined} onClick={()=>navigate(key)}><Icon size={19}/><span>{p.name}</span>{page===key&&<span className="nav-active-dot"/>}</button>;})}</nav>
   <div className="sidebar-spacer"/><div className="workspace-note"><Layers3 size={22}/><strong>由你挑选，逐步积累。</strong><p>模型、动作、图片，一路接着用。</p></div><button className="manage-button" onClick={()=>setManage(true)}><Settings2 size={18}/><span>制作记录与设置</span><ChevronRight size={14}/></button><div className="local-status"><span className={connected?'online-dot':'offline-dot'}/><span>{connected?'本地工作空间':'正在重新连接'}</span><Monitor size={13}/></div>
  </aside>
  <main className="studio-main"><header className="topbar"><div className="breadcrumb"><span>工作空间</span><ChevronRight size={13}/><strong>{pages[page].name}</strong></div><button className="secondary" onClick={()=>fileInput.current.click()} disabled={busy}><Plus size={16}/>导入模型</button></header><div className="page-heading"><div className="page-eyebrow"><span/>{pages[page].name}</div><h1>{pages[page].title}</h1><p>{pages[page].intro}</p></div>
   {!connected&&<div className="connection-banner">正在重新连接，已有文件仍保存在本机。</div>}
   <input type="file" hidden webkitdirectory="" ref={folderInput} onChange={e=>importFiles([...e.target.files])}/>
   <input type="file" hidden multiple ref={fileInput} accept=".glb,.gltf,.fbx,.obj,.bvh,.bin,.mtl,.png,.jpg,.jpeg,.webp" onChange={e=>importFiles([...e.target.files])}/>
   <input type="file" hidden multiple ref={motionInput} accept=".fbx,.glb,.bvh" onChange={e=>importFiles([...e.target.files],'motion')}/>
   <input type="file" hidden multiple ref={referenceInput} accept="image/png,image/jpeg,image/webp" onChange={e=>importFiles([...e.target.files],'reference')}/>
   {page==='flow'&&<AssetFlow assets={assets} jobs={state.jobs} workspace={state.workspace} intent={intent} api={api} onRefresh={refresh} onNavigate={flowNavigate}/>}
   {page==='library'&&<><AssetLibrary covers={state.covers||[]} assets={assets} jobs={state.jobs} libraryId={state.libraryId} intent={libraryIntent} api={api} onRefresh={refresh} onImportModel={()=>fileInput.current.click()} onImportMotion={()=>motionInput.current.click()} onUseModel={openAsset}/>{progress()}</>}
   {page==='generate'&&<GenerationForm modelName={modelName} onName={value=>{generation.update({modelName:value});setQuote(null);}} prompt={prompt} references={referenceCards} ready={generation.ready} status={generation.status} busy={busy} active={running(activeGenerationJob)} quote={quote} onPrompt={value=>{generation.update({prompt:value});setQuote(null);}} onAdd={()=>referenceInput.current.click()} onRemove={index=>{generation.update({references:references.filter((_,i)=>i!==index)});setQuote(null);}} onMove={(index,direction)=>{const next=[...references];[next[index],next[index+direction]]=[next[index+direction],next[index]];generation.update({references:next});setQuote(null);}} onQuote={getQuote} onSubmit={submit} onCancelQuote={()=>setQuote(null)} progress={progress(activeGenerationJob)} onBrowse={()=>{navigate('library');setLibraryIntent({kind:'模型库',nonce:Date.now()});}}/>}
   <footer className="page-footer"><Box size={12}/>资产工坊<span>先看效果，再确认选用。</span></footer>
  </main>
  <ModelImportForm files={modelImportFiles} libraryId={state.libraryId} api={api} onImported={async job=>{setJobId(job.id);await refresh();}} onComplete={()=>{setModelImportFiles([]);navigate('library');setLibraryIntent({kind:'模型库',nonce:Date.now()});setNotice('模型正在整理，完成后可在资产卡片里预览。');}} onClose={()=>setModelImportFiles([])}/>
  {notice&&<div className="toast" role="status"><span>{notice}</span><button className="icon-button" aria-label="关闭提示" onClick={()=>setNotice('')}><X size={16}/></button></div>}
  <Drawer open={manage} onOpenChange={setManage} title="制作记录与设置" description="原始素材和历史产物保留在资产库。"><button className="provider-link" onClick={()=>folderInput.current.click()}>导入带贴图的完整文件夹 <Upload size={14}/></button>
   {activeModel&&<details className="manager-section"><summary>当前模型详情</summary><p>{activeModel.name}<br/>{activeModel.metadata.boneCount||0} 骨骼 · {(activeModel.metadata.triangles||0).toLocaleString()} 三角面<br/>{activeModel.source}<br/>{activeModel.license}</p><label>质量记录<SelectField label="资源质量" value={activeModel.quality} onChange={quality=>run(async()=>{await api('assets/'+activeModel.id+'/quality',{quality});await refresh();})} options={['待查看','可复用','有问题'].map(q=>({value:q,label:q}))}/></label><p>质量记录不决定工作台的选用范围。</p></details>}
   <details className="manager-section" open><summary>最近的制作记录</summary>{state.jobs.slice(0,20).map(j=><div className="manager-job" key={j.id}><strong>{{import:'资源导入',compose:'动作组合','remove-motions':'整理模型动作',frames:'制作序列帧',generate:'生成模型',mixamo:'Mixamo 上传文件','review-frames':'洋葱播放准备'}[j.type]||'素材处理'}</strong><p>{j.stage}</p><div className="manager-job-actions">{j.outputs?.map(id=>{const a=assets.find(v=>v.id===id);return a?<React.Fragment key={id}><button className="text-button" onClick={()=>openAsset(a)}>在工作台查看</button><a className="text-button" href={'/api/assets/'+id+'/download?exact=1'}>下载原产物 <Download size={12}/></a></React.Fragment>:null;})}<button className="text-button" onClick={()=>copyJob(j)}>复制给 Codex</button></div><details><summary>处理详情</summary><p>{j.error}</p><code>{j.id}</code></details></div>)}</details>
  </Drawer>
 </div></TooltipProvider>;
}
createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('captureJob')?<CapturePage/>:<App/>);
