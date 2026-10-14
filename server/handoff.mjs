import fs from 'node:fs';import path from 'node:path';
import {DATA,full,get,list,put,uid,now,library,transaction,saveJson,rel} from './store.mjs';
import {inspectCatalog} from './catalog.mjs';import {prepareAsset} from './jobs.mjs';import {hash} from './glb.mjs';
export function makeHandoff(body){
 const requested=body.refs||[...(body.modelId?['model:'+body.modelId]:[]),...(body.spriteSetIds||[]).map(id=>'sprite-set:'+id),...(body.spritesIds||[]).map(id=>'sprites:'+id),...(body.reviewIds||[]).map(id=>'review:'+id)];
 const refs=[...new Set(requested.flatMap(ref=>ref.startsWith('sprite-set:')?[ref,...inspectCatalog({ref}).actions.map(a=>'sprites:'+a.assetId)]:[ref]))];
 if(!refs.length||refs.length>40)throw Error('请选择 1–40 个模型、序列帧或校对成品引用');
 if(body.planId&&!get('plans',body.planId))throw Error('需求记录不存在');
 const items=refs.map(ref=>{
  if(!/^(model|sprites|sprite-set|review):[^:]+$/.test(ref))throw Error('交付只接受模型、2D 动作集、序列帧和校对报告的精确引用');
  const inspected=inspectCatalog({ref}),a=get('assets',ref.split(':')[1]);if(!fs.existsSync(full(a.file))||hash(fs.readFileSync(full(a.file)))!==a.sha256)throw Error('交付文件缺失或已被外部改变：'+a.name);
  const frames=a.renderManifest?JSON.parse(fs.readFileSync(full(a.renderManifest),'utf8')):null;
  return {ref,name:a.name,sha256:a.sha256,file:full(a.file),relativeFile:a.file,licenseSources:inspected.licenseSources||a.parents.map(id=>({ref:'sprites:'+id,license:get('assets',id)?.license})),quality:a.quality,animations:inspected.animations,frameManifest:frames,spriteSet:a.kind==='sprite-set'?{sourceAssetId:inspected.sourceAssetId,sourceHash:inspected.sourceHash,actions:inspected.actions,playback:inspected.playback}:undefined,pivotConvention:frames||a.kind==='sprite-set'?'原 PNG 完整画布左上角为(0,0)，归一化坐标；游戏导入时不要按轮廓逐帧重居中':undefined,review:inspected.report?{reportHash:inspected.reportHash,decision:inspected.decision}:undefined};
 });
 const model=items.find(a=>a.ref.startsWith('model:')),mappings=body.motionMappings||model?.animations?.filter(c=>!c.reference).map(c=>({role:c.name,index:c.index,name:c.name,sourceRef:c.origin?`motion:${c.origin.assetId}:${c.origin.index}`:null,loop:'unknown',rootMotion:'unknown'}))||[];
 for(const m of mappings)if(!model?.animations?.some(c=>c.index===m.index)||!m.role)throw Error('动作映射必须指向交付模型里的真实片段 index，并指定 role');
 const id=uid(),folder=path.join(DATA,'assets',id);fs.mkdirSync(folder,{recursive:true});
 const content={schemaVersion:1,libraryId:library.libraryId,createdAt:now(),planId:body.planId||null,engine:body.engine||'待目标项目确定',items,motionMappings:mappings,rootMotionPolicy:body.rootMotionPolicy||'unknown',unresolved:body.unresolved||[],notes:body.notes||'',gameIntegrationStatus:'not_performed',nextAction:{instruction:'目标项目 AI 读取自身规则，按 refs 重新 inspect 定位文件，复制到游戏资源目录并连接已有动画控制器；未知循环/根运动和命中帧需先确定。'},pathNote:'绝对路径是本次交接时的快照；资产库迁移后按 libraryId/ref 重新 inspect，不凭旧路径寻找文件。'};
 saveJson(path.join(folder,'asset-workbench-handoff.json'),content);
 const lines=['# 游戏资产交接说明','',`资产库：${library.libraryId}`,`目标引擎：${content.engine}`,'','## 文件和来源','',...items.map(a=>`- ${a.name}：${a.ref}；SHA256 ${a.sha256}；质量 ${a.quality}。`),'','## 接入步骤','','1. 在目标项目读取现有资源目录、角色朝向、单位、控制器和动画状态机。','2. 使用本清单的精确引用重新 inspect；把文件复制到项目，不改动资产库原件。','3. 按 motionMappings 连接真实片段；循环、根运动、攻击命中窗口属于玩法配置。','4. 二维帧使用清单 pivot：原画布左上角为原点，坐标归一化。保留完整画布，不按轮廓逐帧居中。','5. 查看 review 的实际结论和限制。仅生成了报告但没有 decision 时，仍需 Codex 看图判断。','6. 按用户要求进行引擎运行或验收；本交接不代表已完成游戏接入。','','## 待处理','',...(content.unresolved.length?content.unresolved.map(s=>'- '+s):['- 未登记额外缺口；循环、根运动和玩法效果仍以目标项目为准。']),'',content.pathNote];
 fs.writeFileSync(path.join(folder,'使用说明.md'),lines.join('\n'));
 const asset=prepareAsset(path.join(folder,'asset-workbench-handoff.json'),{id,kind:'handoff',name:body.name||'游戏资产交接',parents:items.map(i=>i.ref.split(':')[1]),source:'资产工坊统一交付',license:'继承各项来源许可'});
 transaction(()=>{put('assets',asset);if(body.planId){const p=get('plans',body.planId);put('plans',{...p,request:{...p.request,delivery:{handoffId:id,refs,createdAt:now()}},updatedAt:now()});}});
 return {id,ref:'handoff:'+id,libraryId:library.libraryId,file:full(asset.file),instructions:path.join(folder,'使用说明.md'),sha256:asset.sha256,items:items.map(a=>({ref:a.ref,file:a.file,sha256:a.sha256})),unresolved:content.unresolved,gameIntegrationStatus:content.gameIntegrationStatus,nextAction:content.nextAction};
}
