import fs from 'node:fs';
import path from 'node:path';
import {get,put,full,rel,now} from './store.mjs';

export const coverKey=(asset,index)=>asset.sha256+':'+index+':1';
export function saveAssetCover(body){
 const a=get('assets',body.assetId),index=Number(body.clipIndex);
 if(!a||!['model','motion'].includes(a.kind)||a.sha256!==body.sourceHash)throw Error('封面来源已改变');
 if(!Number.isInteger(index)||index<-1||index>=0&&!a.metadata.animations?.[index])throw Error('封面动作无效');
 const id=coverKey(a,index),old=get('asset-covers',id);if(old&&fs.existsSync(full(old.file)))return old;
 if(typeof body.image!=='string'||!body.image.startsWith('data:image/png;base64,')||body.image.length>1500000)throw Error('封面图片无效');
 const png=Buffer.from(body.image.slice(22),'base64');
 if(png.length<24||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.readUInt32BE(16)!==320||png.readUInt32BE(20)!==320)throw Error('封面应为 320 × 320 PNG');
 const file=full('assets/covers/'+a.sha256+'/'+index+'.png');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,png);
 return put('asset-covers',{id,assetId:a.id,sourceHash:a.sha256,clipIndex:index,file:rel(file),createdAt:now()});
}
