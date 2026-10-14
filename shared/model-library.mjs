// Only explicit lineage joins versions. Similar names or skeletons never imply the same model.
export function modelLibrary(assets){
 const byId=new Map(assets.map(a=>[a.id,a]));
 function origin(a){
  const seen=new Set();let current=a;
  while(current&&!seen.has(current.id)){
   seen.add(current.id);
   const parent=current.modelFamilyId||current.modelRevisionOf||(current.processing?.geometryPreserved?current.parents?.[0]:null);
   if(!parent||!byId.has(parent))break;
   current=byId.get(parent);
  }
  return current||a;
 }
 const groups=new Map();
 for(const a of assets){
  if(a.kind!=='model'||!a.metadata?.vertices||a.usageRole==='motion-source')continue;
  const root=origin(a),key=root.id,group=groups.get(key)||{key,origin:root,asset:a,name:root.modelName||root.name.split(' · ')[0],versions:[]};
  group.versions.push(a);groups.set(key,group);
 }
 for(const g of groups.values()){
  g.versions.sort((a,b)=>Number(!!a.supersededBy)-Number(!!b.supersededBy)||(b.createdAt||'').localeCompare(a.createdAt||''));
  g.asset=g.versions.find(a=>!a.supersededBy&&a.quality!=='有问题')||g.versions[0];
 }
 return [...groups.values()];
}
