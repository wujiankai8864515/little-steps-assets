import {get,put,now,library} from './store.mjs';

const fields=new Set(['clip','chosen','knownClips','frameClip','view','modelView','motionView','size','fps','picker','query','sourceFilter','limit','candidate','sourceMode','mixamoOpen','request','autoKeep','closedReview','preparedSetId','viewport','positions','motionPlayback','framePlayback','onionPlayback']);
export function readWorkspaceDraft(modelId){
 const model=get('assets',modelId),record=get('workspace-drafts',modelId);
 return record&&model?.sha256===record.sourceHash?record:null;
}
export function workspaceDraft(body){
 const model=get('assets',body.modelId);if(model?.kind!=='model')throw Error('工作台模型不存在');
 const old=readWorkspaceDraft(model.id);
 if(!body.patch)return {libraryId:library.libraryId,draft:old};
 if(body.sourceHash!==model.sha256)throw Error('模型已改变，不能恢复其他版本的操作进度');
 if(!body.patch||Array.isArray(body.patch)||JSON.stringify(body.patch).length>32000)throw Error('操作进度数据无效');
 const patch={};for(const [key,value] of Object.entries(body.patch)){if(!fields.has(key))throw Error('未知工作台记忆字段：'+key);patch[key]=value;}
 for(const key of ['clip','frameClip'])if(patch[key]!==undefined&&(!Number.isInteger(patch[key])||patch[key]<-1||patch[key]>=model.metadata.animations.length))throw Error('记忆的动作片段无效');
 for(const key of ['chosen','knownClips'])if(patch[key]!==undefined&&(!Array.isArray(patch[key])||patch[key].length>100||patch[key].some(i=>!Number.isInteger(i)||!model.metadata.animations[i])))throw Error('记忆的动作列表无效');
 if(patch.size!==undefined&&![256,512,1024].includes(patch.size)||patch.fps!==undefined&&![12,24,30].includes(patch.fps))throw Error('图片设置无效');
 for(const key of ['view','modelView','motionView']){const v=patch[key];if(v&&(!Array.isArray(v.position)||!Array.isArray(v.target)||v.position.length!==3||v.target.length!==3||![...v.position,...v.target,v.fov].every(Number.isFinite)||v.fov<=0||v.fov>=180))throw Error('构图数据无效');}
 if(patch.viewport&&(![patch.viewport.x,patch.viewport.y,patch.viewport.zoom].every(Number.isFinite)||patch.viewport.zoom<.1||patch.viewport.zoom>5))throw Error('画布位置无效');
 if(patch.candidate){const c=patch.candidate,a=get('assets',c.assetId);if(!a?.metadata.animations?.[c.index])throw Error('候选动作已不存在');}
 const client=String(body.clientId||'skill').slice(0,100),sequence=Number(body.sequence||0),clients={...(old?.clients||{})};
 if(sequence&&sequence<=(clients[client]||0))return {libraryId:library.libraryId,draft:old,ignored:true};
 if(sequence)clients[client]=sequence;
 const record=put('workspace-drafts',{id:model.id,sourceHash:model.sha256,schemaVersion:1,revision:(old?.revision||0)+1,data:{...old?.data,...patch},clients:Object.fromEntries(Object.entries(clients).slice(-20)),updatedAt:now()});
 return {libraryId:library.libraryId,draft:record};
}

// Compose only appends/reindexes existing animation data; geometry is unchanged.
// Frame products retain their original source ID rather than masquerading as new renders.
export function inheritWorkspaceDraft(sourceId,output,job){
 const old=readWorkspaceDraft(sourceId);if(!old)return;
 const index=i=>job.params.motions.findIndex(m=>m.assetId===sourceId&&m.index===i),data=structuredClone(old.data);
 data.clip=index(data.clip);data.frameClip=index(data.frameClip);
 data.chosen=(data.chosen||[]).map(index).filter(i=>i>=0);
 data.knownClips=job.params.motions.map((m,i)=>m.assetId===sourceId?i:-1).filter(i=>i>=0);
 data.candidate=null;data.sourceMode=false;
 for(const field of ['motionPlayback','framePlayback'])if(data[field])data[field]={...data[field],clipIndex:index(data[field].clipIndex)};
 put('workspace-drafts',{id:output.id,sourceHash:output.sha256,schemaVersion:1,revision:1,data,clients:{},inheritedFrom:sourceId,updatedAt:now()});
 const layout=get('flow-layouts',sourceId);if(layout)put('flow-layouts',{...layout,id:output.id,updatedAt:now()});
}
