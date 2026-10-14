import React,{useEffect,useRef,useState} from 'react';
import {X,Upload,FolderOpen,CloudUpload,LoaderCircle,Image,Box,FileArchive,Check,Play,Film,RotateCcw} from 'lucide-react';
import Stage from './Stage.jsx';
import {importModel,disposeModel} from './model.js';
import {saveAsset,fileRef,newId,formatBytes,FILE_LIMIT,connected} from './github.js';
import {zipSync} from 'fflate';
import {packageFrames} from './frames.js';
export default function UploadDialog({onClose,onSaved,onConnect}){
  const [name,setName]=useState(''),[kind,setKind]=useState('model'),[files,setFiles]=useState([]),[prepared,setPrepared]=useState(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
  const picker=useRef(),folder=useRef(),poster=useRef(),preparedRef=useRef();preparedRef.current=prepared;
  const [clip,setClip]=useState(-1),[quick,setQuick]=useState(false),[quickUrl,setQuickUrl]=useState(''),[previewFrames,setPreviewFrames]=useState(null),[captureControls,setCaptureControls]=useState(null);
  useEffect(()=>{if(!previewFrames){setQuickUrl('');return;}const url=URL.createObjectURL(previewFrames.gif);setQuickUrl(url);return()=>URL.revokeObjectURL(url);},[previewFrames]);
  useEffect(()=>()=>{disposeModel(preparedRef.current?.gltf?.scene);if(preparedRef.current?.url)URL.revokeObjectURL(preparedRef.current.url);},[]);
  function discard(){disposeModel(preparedRef.current?.gltf?.scene);if(preparedRef.current?.url)URL.revokeObjectURL(preparedRef.current.url);setPrepared(null);setClip(-1);setQuick(false);setPreviewFrames(null);poster.current=null;}
  async function tryFrames(){
    if(!captureControls||clip<0)return;setBusy(true);setError('');
    try{const selected=prepared.info.animations[clip],view=captureControls.getView();setProgress('捕获当前动作的临时预览…');const frames=await captureControls.capture({clipIndex:clip,size:256,fps:6,onProgress:(n,total)=>setProgress(`预览捕获 ${n} / ${total} 帧`)});const result=await packageFrames({frames,size:256,fps:6,clips:[{index:clip,name:selected.name,start:0,count:frames.length}],view,name:name.trim()||'临时预览',sourceId:null,onProgress:setProgress});setPreviewFrames(result);}catch(e){setError(e.message);}finally{setBusy(false);setProgress('');}
  }
  async function choose(list){
    if(!list.length)return;discard();setFiles(Array.from(list));setBusy(true);setError('');setProgress('正在读取素材，仅用于当前页面预览…');
    try{
      if(Array.from(list).some(f=>f.size>FILE_LIMIT))throw Error('单个文件请控制在 40 MB 以内');
      if(Array.from(list).reduce((n,f)=>n+f.size,0)>120*1024*1024)throw Error('一次导入请控制在 120 MB 以内');
      if(kind==='model'||kind==='motion')setPrepared(await importModel(list));
      else{
        if(Array.from(list).some(f=>!/^.*\.(png|jpe?g|webp|gif|zip|json|mp3|wav|ogg|bin)$/i.test(f.name)))throw Error('请选择图片、ZIP、JSON、音频或二进制素材文件');
        const images=Array.from(list).filter(f=>/^image\//.test(f.type)&&!f.name.toLowerCase().endsWith('.svg'));
        let blob=list[0],extension=list[0].name.split('.').at(-1).toLowerCase();
        if(list.length>1){const entries={};for(const f of list)entries[f.webkitRelativePath||f.name]=new Uint8Array(await f.arrayBuffer());blob=new Blob([zipSync(entries,{level:0})],{type:'application/zip'});extension='zip';}
        setPrepared({blob,extension,image:images[0]||null,url:images[0]?URL.createObjectURL(images[0]):null});
      }
    }catch(e){setError(e.message);}finally{setBusy(false);setProgress('');}
  }
  async function save(){
    if(!name.trim()||name.trim().length>60){setError('请填写 1–60 个字的素材名称');return;}
    if(!connected()){onConnect();return;}
    setBusy(true);setError('');
    try{
      const id=newId(),path=`assets/${id}/${prepared.gltf?'model.glb':`original.${prepared.extension}`}`,refs=[fileRef(path,prepared.blob)],uploads=[{path,blob:prepared.blob}];
      let posterPath;
      const cover=poster.current||prepared.image;
      if(cover){const p=`assets/${id}/cover.${prepared.image?prepared.image.name.split('.').at(-1).toLowerCase():'png'}`;refs.push(fileRef(p,cover));uploads.push({path:p,blob:cover});posterPath=p;}
      if(prepared.original){const extension=prepared.originalName.split('.').at(-1).toLowerCase(),p=`assets/${id}/source.${extension}`;refs.push(fileRef(p,prepared.original));uploads.push({path:p,blob:prepared.original});}
      const asset={id,name:name.trim(),kind,modelFamilyId:prepared.gltf?id:undefined,createdAt:new Date().toISOString(),status:'pending',files:refs,primaryPath:path,posterPath,source:'用户导入',metadata:prepared.info||{},originalName:files[0]?.name};
      const result=await saveAsset(asset,uploads,setProgress);onSaved(result);onClose();
    }catch(e){setError(e.message);}finally{setBusy(false);setProgress('');}
  }
  const accept=kind==='model'||kind==='motion'?'.glb,.gltf,.fbx,.bin,.png,.jpg,.jpeg,.webp':kind==='image'?'.png,.jpg,.jpeg,.webp,.gif':'.png,.jpg,.jpeg,.webp,.gif,.zip,.json,.mp3,.wav,.ogg,.bin';
  return <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section className="dialog upload-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title">
    <div className="dialog-header"><div><span className="eyebrow">ADD TO YOUR COLLECTION</span><h2 id="upload-title">导入一份新素材</h2></div><button className="icon-button" aria-label="关闭导入窗口" disabled={busy} onClick={onClose}><X size={20}/></button></div>
    <div className="upload-layout"><div className="upload-form"><label className="field-label" htmlFor="asset-name">素材名称</label><input id="asset-name" value={name} onChange={e=>setName(e.target.value)} placeholder="给这份素材起个名字" maxLength={60} disabled={busy}/><label className="field-label" htmlFor="asset-type">资源类型</label><select id="asset-type" value={kind} onChange={e=>{discard();setFiles([]);setKind(e.target.value);}} disabled={busy}><option value="model">3D 模型</option><option value="motion">动作素材</option><option value="image">图片 / 贴图</option><option value="sprite">2D 序列帧 / 图集</option><option value="other">音频 / 其他素材</option></select>
      <div className="file-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)choose(e.dataTransfer.files);}}><Upload size={25} strokeWidth={1.3}/><strong>拖入文件，或选择素材</strong><span>{kind==='model'||kind==='motion'?'GLB · FBX · glTF 完整文件夹':'图片、图集、ZIP 或音频'}</span><button className="secondary small" disabled={busy} onClick={()=>picker.current.click()}>选择文件</button></div>
      {(kind==='model'||kind==='motion')&&<button className="text-button" disabled={busy} onClick={()=>folder.current.click()}><FolderOpen size={15}/>导入含贴图的完整文件夹</button>}
      <input className="hidden" ref={picker} aria-label="选择素材文件" type="file" multiple accept={accept} onChange={e=>choose(e.target.files)}/><input className="hidden" ref={folder} aria-label="选择完整素材文件夹" type="file" webkitdirectory="" multiple onChange={e=>choose(e.target.files)}/>
      {files.length>0&&<div className="file-summary"><Check size={14}/><span>{files.length} 个文件 · {formatBytes(files.reduce((n,f)=>n+f.size,0))}</span></div>}
      <p className="form-note">原文件会保留。导入仅增加库存，制作时由你选用。</p>
    </div><div className="upload-preview">{prepared?.gltf?<>{previewFrames?<div className="quick-frames checkerboard"><img src={quickUrl} alt="临时序列帧预览"/><span>{previewFrames.metadata.frameCount} 帧 · 256 × 256 · 6 fps</span></div>:<Stage gltf={prepared.gltf} clipIndex={clip} frameMode={quick} onControls={setCaptureControls} onPoster={blob=>{if(!quick)poster.current=blob;}}/>}<div className="model-facts"><span>{prepared.info.triangles.toLocaleString()} 三角面</span><span>{prepared.info.boneCount} 骨骼</span><span>{prepared.info.animations.length} 动作</span></div></>:prepared?.url?<img src={prepared.url} alt="素材预览"/>:<div className="preview-empty"><Box size={54} strokeWidth={.75}/><span>素材预览会出现在这里</span></div>}</div></div>
    {prepared?.info?.animations?.length>0&&<div className="import-motion-preview"><label>查看已有动作<select aria-label="导入素材的动作预览" disabled={busy} value={clip} onChange={e=>{setClip(+e.target.value);setPreviewFrames(null);}}><option value={-1}>原始静止外观</option>{prepared.info.animations.map(c=><option key={c.index} value={c.index}>{c.name} · {c.duration.toFixed(1)}s</option>)}</select></label>{previewFrames?<button className="secondary small" disabled={busy} onClick={()=>setPreviewFrames(null)}><RotateCcw size={14}/>重新预览</button>:<button className="secondary small" disabled={busy||clip<0} onClick={()=>quick?tryFrames():setQuick(true)}><Film size={14}/>{quick?'生成临时 GIF':'试做 2D 预览'}</button>}<p>临时预览不上传、不下载。正式动作集可在工作台制作并保存。</p></div>}
    {error&&<p className="inline-error" role="alert">{error}</p>}{progress&&<p className="progress-message" role="status"><LoaderCircle size={15} className="spin"/>{progress}</p>}
    <div className="dialog-footer"><span><CloudUpload size={16}/>保存到公开 GitHub 资源库</span><button className="primary" disabled={!prepared||busy||!name.trim()} onClick={save}>{busy?<LoaderCircle size={17} className="spin"/>:<CloudUpload size={17}/>} {busy?'处理中…':'保存到云端'}</button></div>
  </section></div>;
}
