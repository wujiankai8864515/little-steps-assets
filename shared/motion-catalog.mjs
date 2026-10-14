import {motionProvenance} from './motion-provenance.mjs';
import {rawMotionName,motionName,motionCategory} from './motion-labels.mjs';
function family(label) {
  for(const [name,pattern] of [['行走',/行走|步行|向.走/],['奔跑',/奔跑|慢跑|冲刺|向.跑|跑步/],['跳跃',/跳跃|落地|下落|扑跃/],['拳击',/拳击|出拳|直拳/],['踢击',/踢击/],['翻滚',/翻滚/],['闪避',/闪避/],['待机',/待机/],['倒地',/倒地/],['受击',/受击/],['转身',/转身/],['下蹲',/下蹲/],['射击',/射击|放箭/],['瞄准',/瞄准/],['游泳',/游泳/],['坐姿',/坐姿|坐下|站起/],['施法',/施法|法术/]])if(pattern.test(label))return name;
  return label;
}
export function buildMotionCatalog(assets,jobs,model) {
  const provenance=motionProvenance(assets,jobs),variants=new Map();
  const imported=new Map();
  for(const job of jobs)if(job.type==='import'&&job.state==='succeeded')for(const id of job.outputs||[]) {
    const a=provenance.latest(id);if(a)imported.set(a.id,job.createdAt);
  }
  for(const a of assets) {
    if(a.quality==='有问题'||a.supersededBy)continue;
    for(const c of a.metadata.animations||[]) {
      if(c.reference)continue;
      const original=provenance.origin(a.id,c.index),source=provenance.byId.get(original.assetId),clip=source?.metadata.animations?.[original.index];
      if(!clip||source.quality==='有问题')continue;
      const key=source.id+':'+clip.index;if(variants.has(key))continue;
      const raw=rawMotionName(clip,source),label=motionName(raw);
      variants.set(key,{key,assetId:source.id,index:clip.index,raw,label,source,sourceName:source.name.replace(/ · 已有动作$/,'').replace(/（Mixamo 绑定版）$/,''),duration:clip.duration,group:family(label),rig:source.metadata.rigSignature,importedAt:imported.get(source.id)});
    }
  }
  const existing=new Set((model?.metadata.animations||[]).filter(c=>!c.reference).map(c=>provenance.key(model.id,c.index)));
  const groups=new Map();
  for(const v of variants.values()){
    v.existing=existing.has(v.key);
    const g=groups.get(v.group)||{key:v.group,label:v.group,category:motionCategory(v.group),variants:[]};g.variants.push(v);groups.set(v.group,g);
  }
  const order=['行走','拳击','待机','跳跃','奔跑','翻滚','踢击','射击','下蹲','倒地','受击'];
  for(const g of groups.values())g.variants.sort((a,b)=>{
    const rank=v=>(v.label===g.label?30:0)+(v.rig===model?.metadata.rigSignature?5:0)-(v.existing?1:0);
    return rank(b)-rank(a)||a.sourceName.localeCompare(b.sourceName,'zh');
  });
  const recent=[...variants.values()].filter(v=>v.importedAt).sort((a,b)=>b.importedAt.localeCompare(a.importedAt));
  return {groups:[...groups.values()].sort((a,b)=>(order.includes(a.key)?order.indexOf(a.key):99)-(order.includes(b.key)?order.indexOf(b.key):99)),variants,existing,recent};
}
