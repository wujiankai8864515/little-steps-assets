import path from 'node:path';
import {DATA,list,get,put,now,saveJson} from './store.mjs';
import {assetRoles} from '../shared/asset-roles.mjs';

export function initialRole(a) {
  if(a.kind==='motion')return 'motion-source';
  if(a.kind!=='model')return undefined;
  if(assetRoles.includes(a.usageRole))return a.usageRole;
  if(a.handoffModelId||a.handoffJobId||/Mixamo|Quaternius|动作库|已有动作$/.test(a.source+' '+a.name))return 'motion-source';
  if(/本地合并|本地组合|本地适配/.test(a.source)||a.modelRevisionOf)return 'working';
  return 'character';
}

// Persist the old library's roles once; later user choices are never inferred again.
export function migrateAssetRoles() {
  const assets=list('assets'), pending=assets.filter(a=>['model','motion'].includes(a.kind)&&!a.usageRole);
  if(!pending.length)return;
  saveJson(path.join(DATA,'migrations','asset-roles-'+Date.now()+'.json'),pending);
  const roles=new Map(assets.map(a=>[a.id,a.usageRole||initialRole(a)]));
  // Keep one existing assembled character immediately usable. Other versions remain in the library.
  const hasCharacter=assets.some(a=>roles.get(a.id)==='character'&&!a.supersededBy&&a.metadata.boneCount);
  const latest=!hasCharacter&&pending.find(a=>!a.supersededBy&&roles.get(a.id)==='working'&&a.metadata.vertices&&a.metadata.boneCount);
  if(latest)roles.set(latest.id,'character');
  for(const a of pending)put('assets',{...a,usageRole:roles.get(a.id),roleUpdatedAt:now()});
}

export function replaceCharacter(previous, next) {
  // Model history is separate from material repair aliases: clip indices may change.
  const current=get('assets',previous.id);
  if(current?.usageRole==='character'&&!current.modelReplacedBy) {
    put('assets',{...current,usageRole:'working',modelReplacedBy:next.id,roleUpdatedAt:now()});
  } else if(next.usageRole==='character') {
    Object.assign(next,{usageRole:'working',branchOf:previous.id,name:next.name+' · 历史分支'});
    put('assets',next);
  }
}
