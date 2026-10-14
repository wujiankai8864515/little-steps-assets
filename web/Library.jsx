import React,{useEffect,useState} from 'react';
import {Box,Image,Film,Play,Download,Link,ArrowUpRight,LoaderCircle,CloudUpload,Search,Layers,Music,PackageOpen} from 'lucide-react';
import {readFile,downloadFile,fileLink,formatBytes} from './github.js';
import {parseModel,disposeModel} from './model.js';
import Stage from './Stage.jsx';
export const KINDS={model:'3D 模型',motion:'动作',sprite:'2D 序列帧',image:'图片 / 贴图',other:'其他素材'};
const ICONS={model:Box,motion:Play,sprite:Film,image:Image,other:PackageOpen};
export function useBlobUrl(file){const [url,setUrl]=useState('');useEffect(()=>{let active=true,value;setUrl('');if(file)readFile(file).then(blob=>{value=URL.createObjectURL(blob);if(active)setUrl(value);else URL.revokeObjectURL(value);}).catch(()=>{});return()=>{active=false;if(value)URL.revokeObjectURL(value);};},[file?.path,file?.sha]);return url;}
export function useModel(asset){
  const [value,setValue]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true,loaded;setValue(null);setError('');if(!asset){setBusy(false);return;}
    setBusy(true);const file=asset.files.find(f=>f.path===asset.primaryPath);
    readFile(file).then(blob=>blob.arrayBuffer()).then(async bytes=>{const gltf=await parseModel(bytes);loaded=gltf;if(active)setValue({gltf,bytes});else disposeModel(gltf.scene);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;if(loaded)disposeModel(loaded.scene);};
  },[asset?.id]);
  return {value,error,busy};
}
function AssetCard({versions,filter,onUse,onNotify}){
  const [version,setVersion]=useState(0),[preview,setPreview]=useState(false),[clip,setClip]=useState(-1),[busy,setBusy]=useState(false);
  const asset=versions[version]||versions[0],isModel=asset.primaryPath?.endsWith('.glb'),Icon=ICONS[asset.kind]||PackageOpen;
  const {value,error,busy:loading}=useModel(preview&&isModel?asset:null);
  const picture=useBlobUrl(asset.files.find(f=>f.path===asset.posterPath)||((asset.kind==='image'||asset.primaryPath?.endsWith('.gif'))?asset.files.find(f=>f.path===asset.primaryPath):null));
  const animatedPicture=useBlobUrl(preview&&asset.kind==='sprite'?asset.files.find(f=>f.path===asset.gifPath):null);
  const primary=asset.files.find(f=>f.path===asset.primaryPath);
  async function download(){setBusy(true);try{await downloadFile(primary,asset.name+'.'+primary.path.split('.').at(-1));}catch(e){onNotify(e.message,'error');}finally{setBusy(false);}}
  async function copy(){try{await navigator.clipboard.writeText(fileLink(primary));onNotify('Pages 资源链接已复制；新资源发布完成后即可访问');}catch{onNotify('当前浏览器不支持复制，请在 GitHub 资源分支查看文件','error');}}
  return <article className={`asset-card ${preview?'expanded':''}`}>
    <div className="asset-visual">{preview&&value?<Stage gltf={value.gltf} clipIndex={filter==='motion'||asset.kind==='motion'?Math.max(clip,0):clip} compact/>:picture?<img src={animatedPicture||picture} alt={asset.name} loading="lazy"/>:<div className="asset-fallback"><Icon size={48} strokeWidth={.8}/></div>}{loading&&<span className="asset-loading"><LoaderCircle className="spin" size={22}/></span>}{!preview?<button className="preview-hit" aria-label={`预览 ${asset.name}`} onClick={()=>setPreview(true)}><span className="preview-hover"><Play size={15}/>查看素材</span></button>:<button className="preview-close" aria-label={`关闭 ${asset.name} 的预览`} onClick={()=>{setPreview(false);setClip(-1);}}>×</button>}<span className="asset-kind">{KINDS[asset.kind]||'素材'}</span></div>
    <div className="asset-content"><div className="asset-title-row"><h3>{asset.name}</h3><span className="status-dot" title="待查看，不代表质量已通过"/></div><div className="asset-meta"><span>{isModel?`${asset.metadata?.animations?.length||0} 个动作`:formatBytes(primary?.size||0)}</span><span>·</span><span>{new Date(asset.createdAt).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})}</span><span className="pending-tag">待查看</span></div>
      {error&&<p className="inline-error">{error}</p>}
      {preview&&isModel&&(asset.metadata?.animations?.length||0)>0&&<div className="card-clips">{asset.metadata.animations.map(c=><button key={c.index} className={clip===c.index?'selected':''} onClick={()=>setClip(c.index)}><Play size={12}/><span>{c.name}</span><small>{c.duration.toFixed(1)}s</small></button>)}</div>}
      {versions.length>1&&<details className="version-details"><summary><Layers size={13}/>{versions.length} 个版本</summary>{versions.map((a,i)=><button key={a.id} className={i===version?'selected':''} onClick={()=>{setVersion(i);setPreview(false);}}>{a.name}<small>{new Date(a.createdAt).toLocaleDateString('zh-CN')}</small></button>)}</details>}
      <div className="asset-actions">{isModel&&asset.kind!=='motion'?<button className="asset-use" onClick={()=>onUse(asset)}>在工作台使用<ArrowUpRight size={13}/></button>:<span className="asset-source">{asset.source||'云端素材'}</span>}<button className="icon-button" aria-label={`复制 ${asset.name} 的链接`} title="复制 Pages 链接" onClick={copy}><Link size={15}/></button><button className="icon-button" aria-label={`下载 ${asset.name}`} title="下载一份副本到本机" disabled={busy} onClick={download}>{busy?<LoaderCircle size={15} className="spin"/>:<Download size={15}/>}</button></div>
    </div>
  </article>;
}
export default function Library({catalog,onUpload,onUse,onNotify,loading}){
  const [filter,setFilter]=useState('all'),[search,setSearch]=useState('');
  const assets=catalog.assets.filter(a=>!a.archived&&(filter==='all'||a.kind===filter||(filter==='motion'&&a.metadata?.animations?.length))).filter(a=>a.name.toLowerCase().includes(search.toLowerCase()));
  const groups=new Map();for(const asset of assets){const key=asset.kind==='model'?asset.modelFamilyId||asset.id:asset.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(asset);}
  const counts={model:new Set(catalog.assets.filter(a=>a.kind==='model').map(a=>a.modelFamilyId||a.id)).size,motion:catalog.assets.reduce((n,a)=>n+(a.metadata?.animations?.length||0),0),sprite:catalog.assets.filter(a=>a.kind==='sprite').length};
  return <div className="library-page"><section className="library-hero"><div><span className="eyebrow">A HOME FOR EVERY ASSET</span><h1>创作有迹，素材有家。</h1><p>从一个模型，到一组动作，再到你的下一款游戏。<br/>素材留在云端，灵感留在手边。</p><button className="primary" onClick={onUpload}><CloudUpload size={18}/>导入第一份素材</button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="floating-card floating-model"><Box size={38} strokeWidth={1}/><span>3D MODEL</span></div><div className="floating-card floating-motion"><Play size={23}/><span>MOTION</span><i/><i/><i/></div><div className="floating-card floating-sprite"><div className="pixel-grid">{Array.from({length:9},(_,i)=><span key={i}/>)}</div><span>2D FRAMES</span></div><div className="cloud-dot"><CloudUpload size={24}/></div></div></section>
    <section className="collection-stats"><div><span className="stat-icon"><Box size={19}/></span><strong>{counts.model}</strong><span>3D 模型</span></div><div><span className="stat-icon"><Play size={19}/></span><strong>{counts.motion}</strong><span>动作片段</span></div><div><span className="stat-icon"><Film size={19}/></span><strong>{counts.sprite}</strong><span>2D 动作集</span></div><div className="cloud-stat"><span className="online-dot"/><span>GitHub 云端保存</span><small>Mac 只保留代码</small></div></section>
    <div className="collection-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h2>我的资源库 <small>{catalog.assets.length}</small></h2></div><div className="collection-tools"><label className="search"><Search size={16}/><input aria-label="搜索素材" placeholder="搜索素材…" value={search} onChange={e=>setSearch(e.target.value)}/></label><button className="secondary small" onClick={onUpload}><CloudUpload size={16}/>导入素材</button></div></div>
    <div className="filter-tabs" role="tablist" aria-label="资源分类">{[['all','全部资源'],['model','3D 模型'],['motion','动作'],['sprite','2D 序列帧'],['image','图片 / 贴图'],['other','其他']].map(([key,label])=><button role="tab" aria-selected={filter===key} className={filter===key?'active':''} key={key} onClick={()=>setFilter(key)}>{label}</button>)}</div>
    {loading?<div className="collection-empty"><LoaderCircle size={28} className="spin"/><h3>正在打开云端资源库…</h3></div>:groups.size?<div className="asset-grid">{[...groups.entries()].map(([key,versions])=><AssetCard key={key} versions={versions} filter={filter} onUse={onUse} onNotify={onNotify}/>)}</div>:<div className="collection-empty"><div className="empty-stack"><PackageOpen size={42} strokeWidth={.9}/></div><h3>{search?'还没有找到这份素材':filter==='all'?'你的创作，从这里开始':`还没有${filter==='model'?' 3D 模型':filter==='motion'?'动作素材':filter==='sprite'?' 2D 序列帧':'这类素材'}`}</h3><p>{search?'试试另一个名字，或切换资源分类。':'导入已有素材，在卡片里预览，再选进工作台继续制作。'}</p>{!search&&<button className="secondary" onClick={onUpload}><CloudUpload size={17}/>导入素材</button>}<span className="empty-footnote">上传与生成的结果保存在 GitHub，不自动下载到本机。</span></div>}
    <div className="library-bottom"><span>每份原始素材与来源记录，都值得被保留。</span><span>Little Steps · Asset Studio</span></div>
  </div>;
}
