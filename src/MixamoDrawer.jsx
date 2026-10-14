import React,{useMemo,useRef,useState} from 'react';
import {ArrowUpRight,ArrowRight,Download,Upload,Check,LoaderCircle,Plus} from 'lucide-react';
import {Drawer,ProgressBar} from './components/ui.jsx';
import Viewer from './Viewer.jsx';
const active=j=>['queued','running'].includes(j?.state);

export default function MixamoDrawer({open,onOpenChange,model,modelPicker,assets,jobs,api,onRefresh,onUseModel,onViewMotions,beforeAdopt,inline=false}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const fileInput=useRef();
  const needsRig=!model?.metadata.boneCount;
  const related=useMemo(()=>new Set([model?.id,model?.supersedes].filter(Boolean)),[model?.id,model?.supersedes]);
  const handoffs=jobs.filter(j=>j.type==='mixamo'&&related.has(j.params.modelId));
  const handoff=handoffs[0],uploadFile=assets.find(a=>handoff?.outputs?.includes(a.id)&&a.file.endsWith('.fbx'));
  const imports=jobs.filter(j=>j.type==='import'&&(!needsRig||j.params.riggingReturn)&&(related.has(j.params.handoffModelId)||handoffs.some(h=>h.id===j.params.handoffJobId)));
  const completed=imports.filter(j=>j.state==='succeeded'),importing=imports.some(active);
  const rigged=needsRig&&completed.map(j=>assets.find(a=>j.outputs.includes(a.id)&&a.kind==='model'&&a.metadata.boneCount)).find(Boolean);
  async function prepare(unrigged=!model?.metadata.boneCount){
    setBusy(true);setError('');try{await api('prepare-upload',{modelId:model.id,unrigged,textures:unrigged});await onRefresh();}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function importMotions(files){
    if(!files.length)return;setBusy(true);setError('');
    const targetId=model.id,handoffId=handoff?.id;let queued=0;
    try{
      for(const file of files){
        if(!/\.fbx$/i.test(file.name))throw Error('这里请选择从 Mixamo 下载的 FBX 动作文件。');
        const form=new FormData();form.append('files',file,file.name);form.append('name',file.name.replace(/\.fbx$/i,''));form.append('source','Mixamo · 用户下载');form.append('usageRole','motion-source');form.append('handoffModelId',targetId);if(handoffId)form.append('handoffJobId',handoffId);if(needsRig)form.append('riggingReturn','true');
        await api('import',form);queued++;await onRefresh();
      }
    }catch(e){setError((queued?'已接收 '+queued+' 个文件，其余未完成。':'')+e.message);}finally{setBusy(false);if(fileInput.current)fileInput.current.value='';}
  }
  async function adopt(){
    setBusy(true);setError('');
    try{await beforeAdopt?.();const result=await api('rigging/adopt',{modelId:model.id,sourceHash:model.sha256,riggedId:rigged.id,riggedHash:rigged.sha256,confirmAppearance:true});await onRefresh();onUseModel(result.modelId);onOpenChange(false);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const content=<>
    <div className="mixamo-model">{modelPicker}</div>
    <section className="mixamo-step"><span className="step-number">01</span><div><h3>准备上传的角色</h3><p>把这里的角色文件上传到 Mixamo。</p>
      {active(handoff)?<div className="mixamo-status" role="status"><LoaderCircle size={16} className="spin"/><span>{handoff.stage}</span><ProgressBar value={null} label="准备上传文件"/></div>:uploadFile?<><a className="button primary" href={'/api/assets/'+uploadFile.id+'/download'}><Download size={16}/>下载上传用 FBX</a><small><Check size={12}/>文件已准备好{uploadFile.metadata?.bytes?' · '+(uploadFile.metadata.bytes/1048576).toFixed(1)+' MB':''}</small></>:<button className="primary" disabled={!model||busy} onClick={()=>prepare()}><Upload size={16}/>准备上传文件</button>}
      {['failed','interrupted'].includes(handoff?.state)&&<p className="flow-error">{handoff.error||handoff.stage}</p>}
      <p className="mixamo-hint">{needsRig?'使用原模型导出，不减面。下载后上传到 Mixamo。':'上传版可能显示为白模，原角色的贴图仍会保留。'}</p>
      <details className="mixamo-help"><summary>上传被拒绝时怎么办？</summary><p>可改用无骨架的静止姿势，再按 Mixamo 提示标记关节。</p><button className="text-button" disabled={!model||busy||active(handoff)} onClick={()=>prepare(true)}>准备重新绑定版本 <ArrowRight size={12}/></button></details>
    </div></section>
    <section className="mixamo-step"><span className="step-number">02</span><div><h3>{needsRig?'在 Mixamo 绑定一次':'在 Mixamo 选择和下载动作'}</h3><p>{needsRig?'登录后点 Upload Character 上传，按网站提示放好下巴、手腕、肘、膝和胯部标记，点 Next 完成绑定。':'登录后点 Upload Character 上传。已有该角色时可以直接选动作。'}</p><a className="button secondary" href="https://www.mixamo.com/#/" target="_blank" rel="noreferrer">打开 Mixamo <ArrowUpRight size={16}/></a>
      <div className="mixamo-download-settings"><strong>点击 Download 时</strong><span>格式：FBX Binary</span><span>{needsRig?'必须选 With Skin，带回完整角色和骨骼。可先下载 T-Pose。':'首次选 With Skin，后续同一角色可选 Without Skin。'}</span><span>30 FPS · Keyframe Reduction 选 None</span></div>
    </div></section>
    <section className="mixamo-step"><span className="step-number">03</span><div><h3>{needsRig?'导回已绑定的角色':'导回下载好的动作'}</h3><p>{needsRig?'选择刚下载的 With Skin 文件。在这里确认外观后，接着用当前工作台。':'可一次选择多个 FBX，逐个入库后就能在你的模型上试播。'}</p><input hidden multiple={!needsRig} type="file" accept=".fbx" ref={fileInput} onChange={e=>importMotions([...e.target.files])}/><button className="primary" disabled={!model||busy||importing} onClick={()=>fileInput.current.click()}>{busy?<LoaderCircle size={16} className="spin"/>:<Plus size={16}/>}导入{needsRig?'已绑定的角色':'下载的动作'}</button>
      {importing&&<div className="mixamo-status" role="status"><LoaderCircle size={15} className="spin"/>{needsRig?'正在整理角色和骨骼…':'正在整理动作，完成后自动加入动作库。'}</div>}
      {imports.slice(0,8).map(j=><div className="mixamo-import" key={j.id}><span>{j.params.name}</span><small>{active(j)?'处理中':j.state==='succeeded'?needsRig?'可查看绑定结果':'已入动作库':'未完成'}</small>{['failed','needs_input','interrupted'].includes(j.state)&&<p>{j.error||j.stage}</p>}</div>)}
      {!needsRig&&completed.length>0&&<button className="secondary full" onClick={()=>onViewMotions(completed[0].outputs[0])}>查看刚导入的动作 <ArrowRight size={15}/></button>}
      {rigged&&<div className="rigging-return"><div className="rigging-return-preview"><Viewer asset={rigged} clipIndex={rigged.metadata.animations.find(a=>!a.reference)?.index??-1} embedded frameMode hideToolbar showClipSelector={false}/></div><p>确认是同一个角色、外观和贴图完整，再继续。动作仍由你选择。</p><button className="primary full" disabled={busy||importing} onClick={adopt}><Check size={14}/>确认外观，继续添加动作</button></div>}
    </div></section>
    {error&&<p className="flow-error" role="alert">{error}</p>}
    <p className="mixamo-footnote">登录、网站上传与下载在 Mixamo 页面完成。这里负责准备文件、导回动作和复用。<a target="_blank" rel="noreferrer" href="https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html">查看官方说明</a></p>
  </>;
  if(inline)return open?<div className="inline-mixamo">{content}</div>:null;
  return <Drawer open={open} onOpenChange={onOpenChange} title={needsRig?'给模型绑定骨骼':'从 Mixamo 获取动作'} description={needsRig?'绑定一次，再从本地动作库挑选动作。':'准备角色文件，到网站选动作，再把下载的文件带回来。'}>{content}</Drawer>;
}
