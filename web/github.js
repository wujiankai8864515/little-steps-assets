export const CLOUD={owner:'wujiankai8864515',repo:'little-steps-assets',branch:'asset-library',folder:'library'};
export const REPO_URL=`https://github.com/${CLOUD.owner}/${CLOUD.repo}`;
export const LIBRARY_URL=`${REPO_URL}/tree/${CLOUD.branch}`;
export const PAGES_URL=`https://${CLOUD.owner}.github.io/${CLOUD.repo}/`;
const API=`https://api.github.com/repos/${CLOUD.owner}/${CLOUD.repo}`;
const RAW=`https://raw.githubusercontent.com/${CLOUD.owner}/${CLOUD.repo}`;
export const FILE_LIMIT=40*1024*1024;
export const LIBRARY_LIMIT=900*1024*1024;
let credential='';
let visibility='public';
export const connected=()=>Boolean(credential);
export const disconnect=()=>{credential='';};
export const blankCatalog=()=>({schema:1,name:'Little Steps 资源库',assets:[],workspaces:[],updatedAt:null});
const encodePath=p=>p.split('/').map(encodeURIComponent).join('/');
function safePath(p){if(typeof p!=='string'||!/^assets\/[a-zA-Z0-9_-]+\//.test(p)||p.split('/').some(x=>x==='..'||x==='.'||!x))throw Error('资源路径无效');return p;}
function normalize(value){if(value?.schema!==1||!Array.isArray(value.assets)||!Array.isArray(value.workspaces))throw Error('资源库目录格式不受支持，请保留原目录并检查版本');return value;}
async function api(path,{method='GET',body,accept='application/vnd.github+json',signal}={}){
  const headers={Accept:accept,'X-GitHub-Api-Version':'2026-03-10'};
  if(credential)headers.Authorization=`Bearer ${credential}`;
  if(body!==undefined)headers['Content-Type']='application/json';
  const res=await fetch(path.startsWith('https://api.github.com/')?path:API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal});
  if(!res.ok){const info=await res.json().catch(()=>({}));const err=Error(res.status===401?'GitHub 连接已失效，请重新连接。':res.status===403?'GitHub 拒绝了请求。请检查令牌的 Contents 读写权限或稍后重试。':res.status===404?'未找到资源分支，或当前连接没有访问权限。':res.status===429?'GitHub 请求较多，请稍后重试。':`GitHub 请求失败（${res.status}）：${info.message||res.statusText}`);err.status=res.status;throw err;}
  return res.status===204?null:res.json();
}
async function catalogAt(ref){
  const value=await api(`/contents/catalog.json?ref=${encodeURIComponent(ref)}`,{accept:'application/vnd.github.raw+json'});
  if(value?.encoding==='base64'&&value.content){const data=Uint8Array.from(atob(value.content.replace(/\n/g,'')),c=>c.charCodeAt(0));return normalize(JSON.parse(new TextDecoder().decode(data)));}
  return normalize(value);
}
export async function connect(token){
  const previous=credential;credential=token.trim();
  try{
    if(!credential)throw Error('请填写 GitHub 令牌');
    const [repo,user]=await Promise.all([api(''),api('https://api.github.com/user')]);
    if(!repo.permissions?.push)throw Error('这个 GitHub 账号没有本仓库的写入权限');
    const catalog=await catalogAt(CLOUD.branch);visibility=repo.visibility;
    return {login:user.login,catalog,visibility};
  }catch(e){credential=previous;throw e;}
}
export async function readCatalog(){
  if(credential)return {catalog:await catalogAt(CLOUD.branch),visibility};
  try{
    const response=await fetch(`${PAGES_URL}${CLOUD.folder}/catalog.json`,{cache:'no-store'});
    if(response.ok)return {catalog:normalize(await response.json()),visibility:'public'};
  }catch{}
  try{return {catalog:await catalogAt(CLOUD.branch),visibility:'public'};}
  catch(e){if(e.status===404)return {catalog:blankCatalog(),unavailable:true};throw Error('暂时无法读取云端目录，请检查网络或稍后刷新');}
}
export function fileLink(file){safePath(file.path);return `${PAGES_URL}${CLOUD.folder}/${encodePath(file.path)}`;}
export async function readFile(file,{signal}={}){
  safePath(file.path);
  if(visibility!=='private'){
    try{const published=await fetch(fileLink(file),{cache:'no-store',signal});if(published.ok)return new Blob([await published.arrayBuffer()],{type:file.mime||'application/octet-stream'});}catch(e){if(e.name==='AbortError')throw e;}
  }
  // Blob API is CORS-enabled and supplies new files while Pages is deploying.
  if(!/^[a-f0-9]{40}$/.test(file.sha||''))throw Error('资源缺少 GitHub 文件标识，请刷新目录');
  const headers={Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2026-03-10'};
  if(credential)headers.Authorization=`Bearer ${credential}`;
  const response=await fetch(`${API}/git/blobs/${file.sha}`,{headers,cache:'no-store',signal});
  if(!response.ok)throw Error(`资源读取失败（${response.status}），请刷新资源库后重试`);
  return new Blob([await response.arrayBuffer()],{type:file.mime||'application/octet-stream'});
}
async function base64(blob){
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.slice(reader.result.indexOf(',')+1));reader.onerror=()=>reject(Error('读取上传内容失败'));reader.readAsDataURL(blob);});
}
async function head(){const ref=await api(`/git/ref/heads/${CLOUD.branch}`);const commit=await api(`/git/commits/${ref.object.sha}`);return {sha:ref.object.sha,tree:commit.tree.sha};}
export async function requestPublication(){
  if(!credential)throw Error('请先连接 GitHub');
  // A tiny code-branch pointer gives each resource update its own Pages version.
  // No model, image, frame or asset catalog is copied to the code branch.
  for(let attempt=0;attempt<3;attempt++){
    const ref=await api(`/git/ref/heads/${CLOUD.branch}`);
    let previous;try{previous=await api('/contents/.github/library-state.json?ref=main');}catch(e){if(e.status!==404)throw e;}
    if(previous?.content){try{const value=JSON.parse(atob(previous.content.replace(/\n/g,'')));if(value.libraryCommit===ref.object.sha)return {queued:true};}catch{}}
    const body={message:`Publish cloud library ${ref.object.sha.slice(0,7)}`,branch:'main',content:await base64(new Blob([JSON.stringify({schema:1,libraryCommit:ref.object.sha,updatedAt:new Date().toISOString()},null,2)+'\n'],{type:'application/json'}))};
    if(previous?.sha)body.sha=previous.sha;
    try{await api('/contents/.github/library-state.json',{method:'PUT',body});return {queued:true};}
    catch(e){if(e.status!==409||attempt===2)throw e;}
  }
}
async function commitMutation(mutate,files,message,onProgress){
  if(!credential)throw Error('请先连接 GitHub，文件会直接上传到资源分支');
  for(const file of files){safePath(file.path);if(file.blob.size>FILE_LIMIT)throw Error('单个文件请控制在 40 MB 以内；大型资源适合 GitHub Releases 或对象存储');}
  const firstHead=await head(),firstTree=await api(`/git/trees/${firstHead.tree}?recursive=1`);
  if(firstTree.truncated)throw Error('资源库目录过大，无法完整核对容量；请先整理资源');
  const planned=new Map(firstTree.tree.filter(e=>e.type==='blob').map(e=>[e.path,e.size||0]));
  for(const file of files)planned.set(file.path,file.blob.size);
  if([...planned.values()].reduce((a,b)=>a+b,0)>LIBRARY_LIMIT)throw Error('资源库接近 Pages 的 1 GB 上限，请先改用 Releases 或对象存储');
  const fileEntries=[];
  let sent=0;
  for(const file of files){
    safePath(file.path);
    onProgress?.(`上传文件 ${++sent} / ${files.length}`);
    const value=await api('/git/blobs',{method:'POST',body:{content:await base64(file.blob),encoding:'base64'}});
    file.sha=value.sha;fileEntries.push({path:file.path,mode:'100644',type:'blob',sha:value.sha});
  }
  for(let attempt=0;attempt<3;attempt++){
    onProgress?.('保存资源目录与来源记录…');
    const current=await head();
    const [catalog,tree]=await Promise.all([catalogAt(current.sha),api(`/git/trees/${current.tree}?recursive=1`)]);
    if(tree.truncated)throw Error('资源库目录过大，无法完整核对容量；请先整理资源');
    const existing=new Map(tree.tree.filter(e=>e.type==='blob').map(e=>[e.path,e.size||0]));
    for(const file of files)existing.set(file.path,file.blob.size);
    if([...existing.values()].reduce((a,b)=>a+b,0)>LIBRARY_LIMIT)throw Error('资源库接近 Pages 的 1 GB 上限，请先改用 Releases 或对象存储');
    const next=mutate(structuredClone(catalog));next.updatedAt=new Date().toISOString();
    const createdTree=await api('/git/trees',{method:'POST',body:{base_tree:current.tree,tree:[...fileEntries,{path:'catalog.json',mode:'100644',type:'blob',content:JSON.stringify(next,null,2)+'\n'}]}});
    const commit=await api('/git/commits',{method:'POST',body:{message,tree:createdTree.sha,parents:[current.sha]}});
    try{
      await api(`/git/refs/heads/${CLOUD.branch}`,{method:'PATCH',body:{sha:commit.sha,force:false}});
      onProgress?.('已保存到 GitHub，正在触发 Pages 发布…');
      try{await requestPublication();return {catalog:next,commit:commit.sha,publishing:'queued'};}
      catch(e){return {catalog:next,commit:commit.sha,publishing:'failed',publishError:e.message};}
    }
    catch(e){if((e.status!==409&&e.status!==422)||attempt===2)throw e;onProgress?.('资源库同时有更新，正在合并目录…');}
  }
}
export async function saveAsset(asset,files,onProgress){
  return commitMutation(catalog=>{
    if(catalog.assets.some(a=>a.id===asset.id))throw Error('这份资源已保存，请刷新资源库');
    for(const file of files){const ref=asset.files.find(f=>f.path===file.path);if(ref)ref.sha=file.sha;}
    catalog.assets.unshift(asset);return catalog;
  },files,`Add asset: ${asset.name}`,onProgress);
}
export async function saveWorkspace(workspace,onProgress){
  return commitMutation(catalog=>{const index=catalog.workspaces.findIndex(w=>w.id===workspace.id);if(index<0)catalog.workspaces.push(workspace);else catalog.workspaces[index]=workspace;return catalog;},[],`Save workspace: ${workspace.name}`,onProgress);
}
export async function renameAsset(id,name){
  if(!name.trim()||name.trim().length>60)throw Error('素材名称需要 1–60 个字');
  return commitMutation(catalog=>{const asset=catalog.assets.find(a=>a.id===id);if(!asset)throw Error('素材已不存在');asset.name=name.trim();return catalog;},[],`Rename asset: ${id}`);
}
export async function downloadFile(file,name){
  const blob=await readFile(file),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name||file.path.split('/').at(-1);a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export const fileRef=(path,blob)=>({path,size:blob.size,mime:blob.type||'application/octet-stream'});
export const formatBytes=bytes=>bytes<1024?`${bytes} B`:bytes<1024*1024?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;
export const newId=()=>crypto.randomUUID();
