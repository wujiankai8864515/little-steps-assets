export const assetRoles = ['character', 'motion-source', 'working'];
export const roleLabels = {character:'对外模型', 'motion-source':'动作展示模型', working:'未设为对外模型'};
export function isCharacter(a) {
  return a?.kind==='model' && a.usageRole==='character' && a.quality!=='有问题' && !a.supersededBy && !a.modelReplacedBy;
}
export function currentCharacter(assets, id) {
  const byId=new Map(assets.map(a=>[a.id,a])), seen=new Set();
  let a=byId.get(id);
  while(a&&!seen.has(a.id)) {
    if(isCharacter(a))return a;
    seen.add(a.id);a=byId.get(a.supersededBy||a.modelReplacedBy);
  }
  return assets.find(a=>isCharacter(a)&&a.metadata.boneCount)||assets.find(isCharacter);
}
