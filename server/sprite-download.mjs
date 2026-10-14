import fs from 'node:fs';
import {Zip,ZipPassThrough,strToU8} from 'fflate';
import {readSpriteSet} from './sprite-sets.mjs';

export async function downloadSpriteSet(id,res){
 const set=readSpriteSet(id),unique=[...new Map(set.actions.map(a=>[a.assetId,a])).values()];
 if(unique.some(a=>!a.exists))throw Error('部分序列帧文件缺失，请先恢复原文件');
 const files=unique.map((a,i)=>({...a,archivePath:'actions/'+String(i+1).padStart(2,'0')+'-'+a.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,70)+'.zip'}));
 const byId=new Map(files.map(a=>[a.assetId,a.archivePath]));
 const manifest={schemaVersion:1,libraryId:set.libraryId,ref:set.ref,sourceAssetId:set.sourceAssetId,sourceHash:set.sourceHash,camera:set.camera,size:set.size,fps:set.fps,pivot:set.pivot,playback:set.playback,actions:set.actions.map(a=>({key:a.key,name:a.name,clipIndex:a.clipIndex,frames:a.frames,sha256:a.sha256,file:byId.get(a.assetId)}))};
 res.type('zip').attachment('2d-actions-'+id+'.zip');
 let stream,blocked=false;
 const zip=new Zip((error,data,final)=>{if(error){res.destroy(error);return;}if(!res.destroyed){blocked=!res.write(data);if(final)res.end();}});
 const closed=()=>{stream?.destroy();zip.terminate();};res.once('close',closed);
 try{
  const text=(name,value)=>{const entry=new ZipPassThrough(name);zip.add(entry);entry.push(strToU8(value),true);};
  text('动作集.json',JSON.stringify(manifest,null,2));
  text('使用说明.txt','解压 actions 中各动作 ZIP，可得到原 PNG、图集、GIF 和各自动作清单。\n动作集.json 记录共同构图、锚点、来源版本与当前验收播放顺序。\n原帧未重新缩放或居中；重复播放同一动作不会复制图片。\n');
  for(const file of files){if(res.destroyed)return;const entry=new ZipPassThrough(file.archivePath);zip.add(entry);stream=fs.createReadStream(file.absoluteFile,{highWaterMark:256*1024});for await(const chunk of stream){if(res.destroyed)return;entry.push(chunk,false);if(blocked){await new Promise(resolve=>{const done=()=>{res.off('drain',done);res.off('close',done);resolve();};res.once('drain',done);res.once('close',done);});blocked=false;}}entry.push(new Uint8Array(),true);}
  if(!res.destroyed)zip.end();
 }catch(e){if(!res.destroyed)res.destroy(e);}finally{stream=undefined;}
}
