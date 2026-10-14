import {useEffect,useRef,useState} from 'react';

// Save edits locally immediately, then checkpoint changed fields to the shared library.
export function useGenerationMemory(api,libraryId,serverDraft){
 const [draft,setDraft]=useState({modelName:'',prompt:'',references:[]}),[status,setStatus]=useState('saved'),[ready,setReady]=useState(false);
 const current=useRef(),clientId=useRef(crypto.randomUUID()),sequence=useRef(0),timer=useRef(),queue=useRef(Promise.resolve());
 const cache=e=>{try{localStorage.setItem(e.key,JSON.stringify({data:e.data,pending:e.pending}));}catch{}};
 function flush(beacon=false){
  clearTimeout(timer.current);const e=current.current;
  if(!e||!Object.keys(e.pending).length)return queue.current;
  const patch=structuredClone(e.pending),body={patch,clientId:clientId.current,sequence:++sequence.current};
  if(beacon){try{navigator.sendBeacon('/api/generation/draft',new Blob([JSON.stringify(body)],{type:'application/json'}));}catch{}return queue.current;}
  queue.current=queue.current.catch(()=>{}).then(()=>api('generation/draft',body)).then(()=>{
   for(const [k,v] of Object.entries(patch))if(JSON.stringify(e.pending[k])===JSON.stringify(v))delete e.pending[k];
   cache(e);setStatus(Object.keys(e.pending).length?'saving':'saved');
  }).catch(()=>setStatus('local'));return queue.current;
 }
 function update(patch){
  const e=current.current;if(!e)return;
  for(const [k,v] of Object.entries(patch))if(JSON.stringify(e.data[k])!==JSON.stringify(v)){e.data[k]=v;e.pending[k]=v;}
  setDraft({...e.data});cache(e);if(Object.keys(e.pending).length){setStatus('saving');clearTimeout(timer.current);timer.current=setTimeout(()=>flush(),450);}
 }
 useEffect(()=>{
  if(!libraryId||current.current?.libraryId===libraryId)return;
  const key='asset-workbench:'+libraryId+':generation';let local;try{local=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  const data={modelName:'',prompt:'',references:[],...(serverDraft?.data||local?.data),...local?.pending};
  current.current={key,libraryId,data,pending:local?.pending||{}};setDraft(data);setReady(true);
  if(Object.keys(current.current.pending).length)flush();
 },[libraryId]);
 useEffect(()=>{const save=()=>flush(true),visibility=()=>{if(document.hidden)save();};addEventListener('pagehide',save);document.addEventListener('visibilitychange',visibility);return()=>{removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',visibility);save();};},[]);
 return {draft,update,flush,status,ready,read:()=>current.current?.data||draft};
}
