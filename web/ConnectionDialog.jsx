import React,{useState} from 'react';
import {X,Github,ArrowUpRight,ShieldCheck,LoaderCircle,KeyRound} from 'lucide-react';
import {connect,REPO_URL} from './github.js';
export default function ConnectionDialog({onClose,onConnected}){
  const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{const result=await connect(token);setToken('');onConnected(result);onClose();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section className="dialog connection-dialog" role="dialog" aria-modal="true" aria-labelledby="connection-title">
    <button className="dialog-close icon-button" aria-label="关闭连接窗口" disabled={busy} onClick={onClose}><X size={20}/></button>
    <div className="dialog-emblem"><Github size={28}/></div><span className="eyebrow">YOUR CLOUD LIBRARY</span>
    <h2 id="connection-title">连接你的 GitHub</h2><p className="dialog-intro">连接后，素材从网页直接存入你的仓库。</p>
    <div className="connection-repo"><Github size={18}/><div><strong>little-steps-assets</strong><span>wujiankai8864515 · 公开资源库</span></div><ArrowUpRight size={18}/></div>
    <div className="setup-steps"><div><span>1</span><p>在 GitHub 创建一个 Fine-grained token。<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">打开 GitHub 设置 <ArrowUpRight size={13}/></a></p></div><div><span>2</span><p>只选择 <b>little-steps-assets</b>，将 <b>Contents</b> 设为 <b>Read and write</b>。</p></div><div><span>3</span><p>复制令牌，粘贴到下方完成连接。</p></div></div>
    <form onSubmit={submit}><label className="field-label" htmlFor="github-token">GitHub 令牌</label><div className="token-input"><KeyRound size={17}/><input id="github-token" type="password" autoComplete="off" placeholder="github_pat_…" value={token} onChange={e=>setToken(e.target.value)} disabled={busy}/></div>{error&&<p className="inline-error" role="alert">{error}</p>}<button className="primary full-width" disabled={busy||!token.trim()}>{busy?<LoaderCircle size={17} className="spin"/>:<Github size={17}/>} {busy?'正在连接…':'连接资源仓库'}</button></form>
    <p className="privacy-note"><ShieldCheck size={15}/>令牌仅在当前页面内存中使用，关闭或刷新页面后清除。</p>
  </section></div>;
}
