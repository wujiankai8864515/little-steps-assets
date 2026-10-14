import React,{useEffect,useState} from 'react';
import {Trash2} from 'lucide-react';
import {Drawer} from './components/ui.jsx';
import {rawMotionName,motionName} from './motion-labels.js';

export default function ModelActionsDrawer({open,onOpenChange,model,pending,onRemove}) {
  const [selected,setSelected]=useState([]);
  useEffect(()=>setSelected([]),[model?.id,open]);
  const clips=(model?.metadata.animations||[]).filter(c=>!c.reference);
  function toggle(index){setSelected(v=>v.includes(index)?v.filter(i=>i!==index):[...v,index]);}
  return <Drawer open={open} onOpenChange={onOpenChange} title="管理模型动作" description="从这个模型移除不需要的动作。动作库里的原动作仍可再次使用。">
    <div className="model-action-heading"><strong>{model?.name}</strong><span>{clips.length} 个动作</span></div>
    <div className="model-action-list">{clips.map(c=><label key={c.index}><input type="checkbox" checked={selected.includes(c.index)} disabled={pending} onChange={()=>toggle(c.index)}/><span>{motionName(rawMotionName(c,model))}</span><small>{c.duration.toFixed(1)} 秒</small></label>)}</div>
    {!clips.length&&<p className="empty-state">这个模型还没有动作。</p>}
    <button className="primary full remove-model-actions" disabled={!selected.length||pending} onClick={async()=>{const result=await onRemove(selected);if(result)onOpenChange(false);}}><Trash2 size={15}/>从模型删除{selected.length?' '+selected.length+' 个':''}动作</button>
    <p className="action-note">自动保留修改前的版本，可在“我的作品 → 其他”找回。</p>
  </Drawer>;
}
