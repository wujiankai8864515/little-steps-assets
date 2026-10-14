// Follow recorded composition inputs, never assume that equal clip names are equal motions.
export function motionProvenance(assets, jobs=[]) {
  const byId=new Map(assets.map(a=>[a.id,a]));
  const madeBy=new Map();
  for(const job of jobs)if(job.type==='compose'&&job.state==='succeeded')for(const id of job.outputs||[])if(!madeBy.has(id))madeBy.set(id,job);
  function latest(id){const seen=new Set();let a=byId.get(id);while(a?.supersededBy&&!seen.has(a.id)){seen.add(a.id);a=byId.get(a.supersededBy)||a;}return a;}
  function resolve(assetId,index,seen=new Set(),preferLatest=true) {
    const a=byId.get(assetId),key=assetId+':'+index;
    if(!a||seen.has(key))return {assetId,index};seen.add(key);
    if(a.motionOrigins?.[index]) {const p=a.motionOrigins[index];if(p.assetId!==a.id||p.index!==index)return resolve(p.assetId,p.index,seen,preferLatest);}
    if(a.supersedes&&byId.get(a.supersedes)?.metadata.animations?.[index])return resolve(a.supersedes,index,seen,preferLatest);
    const job=madeBy.get(a.id),p=job?.params,target=byId.get(p?.modelId);
    if(p&&target) {
      const picks=[];
      if(p.keepExisting!==false)for(const clip of target.metadata.animations||[])if(!clip.reference)picks.push({assetId:target.id,index:clip.index});
      for(const m of p.motions||[])if(!picks.some(x=>x.assetId===m.assetId&&x.index===m.index))picks.push(m);
      // Historical defaults changed. Counts alone cannot establish clip order.
      const sequence=p.keepExisting===true?picks:p.keepExisting===false?p.motions:null;
      if(sequence?.length===a.metadata.animations?.length&&sequence?.[index])return resolve(sequence[index].assetId,sequence[index].index,seen,preferLatest);
      return {assetId:a.id,index,provenanceStatus:'unknown'};
    }
    const current=preferLatest?(latest(a.id)||a):a;
    return {assetId:current.id,index};
  }
  const origin=(id,index)=>resolve(id,index);
  return {origin,identity:(id,index)=>resolve(id,index,new Set(),false),latest,byId,key:(id,index)=>{const o=origin(id,index);return o.assetId+':'+o.index;}};
}
