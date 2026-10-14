import {list,get,library} from './store.mjs';
import {modelLibrary} from '../shared/model-library.mjs';
import {buildMotionCatalog} from '../shared/motion-catalog.mjs';
import {coverKey} from './asset-covers.mjs';

export function readLibrary(body={}){
 const assets=list('assets'),jobs=list('jobs'),byId=new Map(assets.map(a=>[a.id,a]));
 const base=(a,kind=a.kind)=>({ref:kind+':'+a.id,assetId:a.id,name:a.name,sha256:a.sha256,source:a.source,sourceQuality:a.quality,license:a.license,coverUrl:a.thumbnail?'/files/'+a.thumbnail:null,previewUrl:'/?panel=library&asset='+a.id,downloadUrl:'/api/assets/'+a.id+'/download?exact=1'});
 let items;
 if(!body.kind||body.kind==='model')items=modelLibrary(assets).map(g=>({...base(g.asset,'model'),name:g.name,familyId:g.key,rigState:g.asset.metadata.boneCount?'present':'missing',nextAction:g.asset.metadata.boneCount?null:{command:'upload',arguments:{modelId:g.asset.id,unrigged:true,textures:true},uiUrl:'/?panel=mixamo&model='+g.asset.id},versions:g.versions.map(a=>({ref:'model:'+a.id,name:a.name,sha256:a.sha256,preferred:!a.supersededBy}))}));
 else if(body.kind==='motion')items=[...buildMotionCatalog(assets,jobs,null).variants.values()].map(v=>{const cover=get('asset-covers',coverKey(v.source,v.index));return {...base(v.source,'motion'),ref:'motion:'+v.assetId+':'+v.index,name:v.label,sourceName:v.sourceName,index:v.index,duration:v.duration,previewUrl:'/?panel=library&asset='+v.assetId+'&clip='+v.index,coverUrl:cover?'/files/'+cover.file:v.source.thumbnail?'/files/'+v.source.thumbnail:null};});
 else if(body.kind==='sprites'){
  const grouped=new Set(assets.filter(a=>a.kind==='sprite-set').flatMap(a=>a.parents||[]));
  items=assets.filter(a=>a.kind==='sprite-set'&&!a.supersededBy||a.kind==='sprites'&&!grouped.has(a.id)).map(a=>({...base(a),sourceModelRef:a.sourceAssetId?'model:'+a.sourceAssetId:null,sourceModelName:byId.get(a.sourceAssetId||a.parents?.[0])?.name,downloadUrl:a.kind==='sprite-set'?'/api/sprite-sets/'+a.id+'/download':'/api/assets/'+a.id+'/download?exact=1'}));
 }else throw Error('资产库类型应为 model、motion 或 sprites');
 const q=String(body.q||'').trim().toLowerCase(),filtered=items.filter(a=>!q||[a.name,a.sourceName,a.sourceModelName,a.source].filter(Boolean).join(' ').toLowerCase().includes(q)),offset=Math.max(0,Math.floor(Number(body.offset)||0)),limit=Math.max(1,Math.min(100,Math.floor(Number(body.limit)||24)));
 return {libraryId:library.libraryId,kind:body.kind||'model',total:filtered.length,offset,limit,items:filtered.slice(offset,offset+limit),note:'此目录与网页资产库一致。入库、封面和播放都不代表工作台选用或质量通过；具体版本与片段使用精确 ref。'};
}
