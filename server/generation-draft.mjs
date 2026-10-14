import {get,put,now,library} from './store.mjs';

export const readGenerationDraft=()=>get('generation-drafts','current');

// A draft only records local input and task references. It cannot submit a paid task.
export function generationDraft(body){
 const old=readGenerationDraft();
 if(!body.patch)return {libraryId:library.libraryId,draft:old};
 if(typeof body.patch!=='object'||Array.isArray(body.patch)||JSON.stringify(body.patch).length>20000)throw Error('生成草稿无效');
 const patch={};
 for(const [key,value] of Object.entries(body.patch)){
  if(key==='modelName'){
   if(typeof value!=='string'||value.length>60||/[\u0000-\u001f\u007f]/.test(value))throw Error('模型名称最多 60 字');
   patch.modelName=value;
  }else if(key==='prompt'){
   if(typeof value!=='string'||value.length>4000)throw Error('描述或备注最多 4000 字');
   patch.prompt=value;
  }else if(key==='references'){
   if(!Array.isArray(value)||value.length>32)throw Error('参考图最多 32 张');
   const seen=new Set();
   patch.references=value.map(item=>{
    if(!!item.jobId===!!item.assetId)throw Error('每张参考图只提供 jobId 或 assetId');
    const job=item.jobId?get('jobs',item.jobId):null,a=item.assetId?get('assets',item.assetId):null;
    if(!a&&!job||a&&a.kind!=='image'||job&&(job.type!=='import'||!(/\.(png|jpe?g|webp)$/i.test(job.params.entry||''))))throw Error('参考图来源无效');
    const key=item.assetId||item.jobId;if(seen.has(key))throw Error('不要重复添加同一张参考图');seen.add(key);
    return {key,...(item.jobId?{jobId:job.id}:{assetId:a.id}),name:String(item.name||a?.name||job?.params.name||'参考图').slice(0,200)};
   });
  }else throw Error('未知生成草稿字段：'+key);
 }
 const client=String(body.clientId||'skill').slice(0,100),sequence=Number(body.sequence||0),clients={...(old?.clients||{})};
 if(sequence&&sequence<=(clients[client]||0))return {libraryId:library.libraryId,draft:old,ignored:true};
 if(sequence)clients[client]=sequence;
 const draft=put('generation-drafts',{...old,id:'current',data:{...old?.data,...patch},revision:(old?.revision||0)+1,clients:Object.fromEntries(Object.entries(clients).slice(-20)),updatedAt:now()});
 return {libraryId:library.libraryId,draft};
}

export function rememberGenerationJob(job){
 const old=readGenerationDraft();
 put('generation-drafts',{...old,id:'current',lastJobId:job.id,updatedAt:now()});
}
