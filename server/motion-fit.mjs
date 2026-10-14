import {get,list,put,uid,now} from './store.mjs';
export function resolvePick(pick){
 if(!pick.ref)return pick;const parts=String(pick.ref).split(':'),a=get('assets',parts[1]),index=Number(parts[2]);
 if(parts.length!==3||parts[0]!=='motion'||!a||!Number.isInteger(index)||!a.metadata.animations?.[index]||a.metadata.animations[index].reference)throw Error('需要有效的精确 motion 引用');
 return {assetId:a.id,index,...(pick.name?{name:pick.name}:{})};
}
export function targetFit(modelId,ref){
 const target=get('assets',modelId);if(!target)return null;const p=resolvePick({ref}),source=get('assets',p.assetId);
 const preview=list('previews').find(v=>v.modelId===modelId&&v.assetId===p.assetId&&v.index===p.index&&v.state==='succeeded');
 return list('motion-fits').find(f=>f.modelId===modelId&&f.modelHash===target.sha256&&f.ref===ref&&f.sourceHash===source.sha256&&f.previewId===preview?.id&&f.adaptationVersion===preview?.version)||null;
}
export function saveTargetFit(body){
 const p=resolvePick(body),target=get('assets',body.modelId),source=get('assets',p.assetId),preview=get('previews',body.previewId);
 if(!target||preview?.state!=='succeeded'||preview.modelId!==target.id||preview.assetId!==source.id||preview.index!==p.index)throw Error('请先完成同一目标与精确动作的试播');
 if(!['usable','issue','unknown'].includes(body.status)||!body.notes||!Array.isArray(body.evidence)||!body.evidence.length)throw Error('请提供 status、notes 与真实 evidence 路径或报告引用');
 return put('motion-fits',{id:uid(),modelId:target.id,modelHash:target.sha256,ref:`motion:${source.id}:${p.index}`,sourceHash:source.sha256,previewId:preview.id,adaptationVersion:preview.version,status:body.status,purpose:String(body.purpose||''),notes:String(body.notes),evidence:body.evidence,reviewedAt:now()});
}
