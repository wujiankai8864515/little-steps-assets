import React,{useEffect,useState} from 'react';
import {Check,LoaderCircle} from 'lucide-react';
import {Drawer} from './components/ui.jsx';

export default function ModelImportForm({files,libraryId,api,onImported,onComplete,onClose}){
 const [entries,setEntries]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!files.length)return;
  const independent=files.length>1&&files.every(f=>/\.(fbx|bvh|glb)$/i.test(f.name));
  setEntries((independent?files.map(f=>[f]):[files]).map(batch=>{
   const entry=batch.find(f=>/\.(glb|gltf|fbx|obj|bvh)$/i.test(f.name));
   const key='asset-workbench:'+libraryId+':import-name:'+batch.map(f=>[f.name,f.size,f.lastModified].join(':')).join('|');
   let name='';try{name=localStorage.getItem(key)||'';}catch{}
   return {files:batch,key,name,fileName:entry?.name||'未选择模型文件',valid:!!entry};
  }));setError('');
 },[files]);
 function rename(index,name){setEntries(v=>v.map((e,i)=>i===index?{...e,name}:e));try{localStorage.setItem(entries[index].key,name);}catch{}}
 async function submit(event){
  event.preventDefault();setBusy(true);setError('');
  try{
   if(entries.some(e=>!e.valid))throw Error('请选择模型文件；贴图需要和 GLTF / OBJ 等模型一起导入。');
   for(let i=0;i<entries.length;i++){
    const e=entries[i];if(e.jobId)continue;if(!e.name.trim())throw Error('请为每个模型填写名称');
    const form=new FormData();for(const f of e.files)form.append('files',f,f.webkitRelativePath||f.name);
    form.append('name',e.name.trim());form.append('usageRole','character');
    const job=await api('import',form);setEntries(v=>v.map((item,k)=>i===k?{...item,jobId:job.id}:item));await onImported(job);
   }
   onComplete();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <Drawer open={!!files.length} onOpenChange={v=>{if(!v&&!busy)onClose();}} title="给模型起个名字" description="名称会显示在模型库里。每个独立模型都需要命名。">
  <form className="model-import-form" onSubmit={submit}>{entries.map((entry,index)=><label className="model-name-label" key={entry.key}><span>{entry.fileName}{entry.jobId&&<Check size={14}/>}</span><input required maxLength={60} aria-label={'模型名称 '+(index+1)} value={entry.name} disabled={busy||!!entry.jobId} placeholder="例如：女主角、刀盾士兵" onChange={e=>rename(index,e.target.value)}/>{entry.files.length>1&&<small>连同 {entry.files.length-1} 个依赖文件一起导入</small>}</label>)}
   {error&&<p className="flow-error" role="alert">{error}</p>}
   <button className="primary full" type="submit" disabled={busy||!entries.length||entries.some(e=>!e.name.trim()||!e.valid)}>{busy?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>}命名并导入</button>
  </form>
 </Drawer>;
}
