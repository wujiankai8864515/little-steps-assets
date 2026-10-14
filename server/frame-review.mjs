import fs from 'node:fs';import path from 'node:path';
import {get,list,put,uid,now,full} from './store.mjs';import {hash} from './glb.mjs';
export function reviewRequest(body){
 if(!Array.isArray(body.selections)||!body.selections.length||body.selections.length>30)throw Error('请选择 1–30 个序列帧动作');
 const selections=body.selections.map(p=>{
  const a=get('assets',p.assetId);if(a?.kind!=='sprites'||!a.renderManifest)throw Error('请选择带帧清单的序列帧资产');
  if(!fs.existsSync(full(a.file))||hash(fs.readFileSync(full(a.file)))!==a.sha256)throw Error('序列包文件缺失或已被外部修改，请重新入库');
  const manifest=JSON.parse(fs.readFileSync(full(a.renderManifest),'utf8')),index=p.clipIndex??(manifest.clips.length===1?(manifest.clips[0].index??0):null),clip=manifest.clips.find((c,i)=>(c.index??i)===index);
  if(!clip||!clip.frames?.length||clip.frames.length>720)throw Error('请选择清单中的有效片段（最多 720 帧）');
  return {assetId:a.id,sha256:a.sha256,clipIndex:index,label:p.label||clip.name,loop:p.loop===true,file:full(a.file),manifest,clip};
 });
 const pairs=body.pairs||[...selections.slice(1).map((s,i)=>({fromAction:i,toAction:i+1,fromFrame:selections[i].clip.frames.length-1,toFrame:0,kind:'transition'})),...selections.flatMap((s,i)=>s.loop?[{fromAction:i,toAction:i,fromFrame:s.clip.frames.length-1,toFrame:0,kind:'loop'}]:[])];
 if(!Array.isArray(pairs)||pairs.length>60)throw Error('一次最多比较 60 组接缝');
 for(const p of pairs)for(const side of ['from','to']){const s=selections[p[side+'Action']],i=p[side+'Frame'];if(!s||!Number.isInteger(i)||i<0||i>=s.clip.frames.length)throw Error('比较帧不在所选动作内');}
 return {name:String(body.name||'动作衔接与锚点校对').slice(0,120),selections,pairs,intent:['direct','blend','anchors','loop'].includes(body.intent)?body.intent:'direct',rootMotionPolicy:['preserve','in_place','unknown'].includes(body.rootMotionPolicy)?body.rootMotionPolicy:'unknown',previousReviewId:body.previousReviewId||null};
}
export function reviewOptions(){return list('assets').filter(a=>a.kind==='sprites'&&a.renderManifest&&fs.existsSync(full(a.renderManifest))).map(a=>{
 try{const m=JSON.parse(fs.readFileSync(full(a.renderManifest),'utf8'));return {assetId:a.id,name:a.name,sourceAssetId:m.sourceAssetId||a.parents?.[0],sourceHash:m.sourceHash,size:m.size,camera:m.camera,pivot:m.pivot,clips:m.clips.map((c,i)=>({index:c.index??i,name:c.name,frames:c.frames.length,loop:!!m.loop}))};}catch{return null;}
}).filter(Boolean);}
export function readReview(id){
 const a=get('assets',id);if(a?.kind!=='review')throw Error('校对报告不存在');
 const report=JSON.parse(fs.readFileSync(full(a.file),'utf8')),base=path.dirname(a.file).replaceAll('\\','/');
 const decisions=list('review-decisions').filter(d=>d.reviewId===id&&d.reportHash===a.sha256),evidenceVerified=hash(fs.readFileSync(full(a.file)))===a.sha256&&report.evidence.every(e=>e.sha256&&fs.existsSync(full(base+'/'+e.file))&&hash(fs.readFileSync(full(base+'/'+e.file)))===e.sha256);
 return {id,ref:'review:'+id,name:a.name,reportHash:a.sha256,evidenceVerified,file:full(a.file),report,baseUrl:'/files/'+base+'/',evidence:report.evidence.map(e=>({...e,file:full(base+'/'+e.file),url:'/files/'+base+'/'+e.file})),decision:evidenceVerified?decisions[0]||null:null,decisions,aiStatus:evidenceVerified&&decisions.length?'已判断':'等待 Codex 看图判断',nextAction:evidenceVerified&&decisions.length?null:{command:evidenceVerified?'review-result':'review-frames',arguments:evidenceVerified?{id,reportHash:a.sha256}:{selections:report.actions.map(a=>({assetId:a.assetId,clipIndex:a.clipIndex,loop:a.loop})),intent:report.intent,rootMotionPolicy:report.rootMotionPolicy},instruction:evidenceVerified?'查看 evidence 中的接缝图、动作内叠加图与原帧，再提交带证据 ID 的判断。不能把测量完成当质量通过。':'证据缺少哈希或文件已改变，请重新生成校对，不沿用旧判断。'}};
}
export function saveReviewDecision(body){
 const view=readReview(body.id);if(body.reportHash!==view.reportHash)throw Error('证据版本改变，请重新读取报告和图片');
 if(!view.evidenceVerified)throw Error('证据图片缺失、改变或未记录哈希，请重新生成报告');
 if(!['usable_with_notes','needs_adjustment','inconclusive'].includes(body.verdict))throw Error('请给出可用但有说明、需要调整或无法判断的结论');
 if(!Array.isArray(body.observations)||!body.observations.length||body.observations.length>30)throw Error('请提供带图片证据的观察');
 for(const key of ['anchors','clipping','continuity','footSlip'])if(!['pass','issue','not_assessed'].includes(body.checks?.[key]))throw Error('checks 需分别声明 anchors/clipping/continuity/footSlip 为 pass、issue 或 not_assessed');
 const ids=new Set(view.report.evidence.map(e=>e.id));
 for(const o of body.observations)if(!Array.isArray(o.evidence)||!o.evidence.length||o.evidence.some(id=>!ids.has(id))||!o.issue||!o.suggestion)throw Error('每项观察需要有效证据 ID、问题/发现和建议');
 const decision=put('review-decisions',{id:uid(),reviewId:body.id,reportHash:body.reportHash,reviewer:String(body.reviewer||'Codex').slice(0,100),verdict:body.verdict,checks:body.checks,summary:String(body.summary||'').slice(0,3000),observations:body.observations,limitations:String(body.limitations||'').slice(0,3000),createdAt:now()});
 return {...decision,nextAction:{command:'inspect',arguments:{ref:'review:'+body.id}},note:'结论仅适用于这些模型、动作和取景；没有修改原图或自动改变资产质量标记'};
}
