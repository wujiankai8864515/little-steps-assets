// Keep the last interaction locally before a throttled shared-library checkpoint.
// Only changed fields are sent; this record never changes asset selection/quality.
export function createWorkspaceMemory(api,onStatus){
 const entries=new Map(),clientId=crypto.randomUUID();let current=null,timer,sequence=0,queue=Promise.resolve();
 const key=e=>'asset-workbench:'+e.libraryId+':draft:'+e.id;
 const cache=e=>{try{localStorage.setItem(key(e),JSON.stringify({sourceHash:e.sourceHash,data:e.data,pending:e.pending}));}catch{}};
 function open(flow){
  if(current&&current.id!==flow.modelId)flush();
  const id=flow.modelId;let e=entries.get(id);
  if(!e){let local;try{local=JSON.parse(localStorage.getItem('asset-workbench:'+flow.libraryId+':draft:'+id)||'null');}catch{}
   if(local?.sourceHash!==flow.model.sha256)local=null;
   e={id,libraryId:flow.libraryId,sourceHash:flow.model.sha256,data:{...(flow.draft?.data||local?.data),...local?.pending},pending:local?.pending||{}};entries.set(id,e);
  }
  current=e;onStatus(Object.keys(e.pending).length?'saving':'saved');if(Object.keys(e.pending).length)schedule();return e.data;
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>flush(),450);}
 function update(patch){if(!current)return;let changed=false;for(const [name,value] of Object.entries(patch)){if(value===undefined||JSON.stringify(current.data[name])===JSON.stringify(value))continue;current.data[name]=value;current.pending[name]=value;changed=true;}if(!changed)return;cache(current);onStatus('saving');schedule();}
 function flush(beacon=false){
  clearTimeout(timer);const e=current;if(!e||!Object.keys(e.pending).length)return queue;
  const patch=structuredClone(e.pending),body={modelId:e.id,sourceHash:e.sourceHash,patch,clientId,sequence:++sequence};
  if(beacon){try{navigator.sendBeacon('/api/workspace/draft',new Blob([JSON.stringify(body)],{type:'application/json'}));}catch{}return queue;}
  const save=queue.catch(()=>{}).then(()=>api('workspace/draft',body)).then(()=>{for(const [k,v] of Object.entries(patch))if(JSON.stringify(e.pending[k])===JSON.stringify(v))delete e.pending[k];cache(e);if(current===e)onStatus(Object.keys(e.pending).length?'saving':'saved');}).catch(()=>{if(current===e)onStatus('local');});queue=save;return save;
 }
 return {open,update,flush,data:()=>current?.data||{},currentId:()=>current?.id,dispose:()=>{clearTimeout(timer);flush(true);}};
}
