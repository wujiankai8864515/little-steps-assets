import {zip,strToU8} from 'fflate';
const png=canvas=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG 编码失败')),'image/png'));
const archive=entries=>new Promise((resolve,reject)=>zip(entries,{level:1},(error,result)=>error?reject(error):resolve(result)));
function send(worker,message,transfer=[]){return new Promise((resolve,reject)=>{const done=event=>{worker.removeEventListener('message',done);worker.removeEventListener('error',failed);event.data.type==='error'?reject(Error(event.data.message)):resolve(event.data);};const failed=e=>{worker.removeEventListener('message',done);reject(Error(e.message||'GIF 编码失败'));};worker.addEventListener('message',done);worker.addEventListener('error',failed,{once:true});worker.postMessage(message,transfer);});}
export async function packageFrames({frames,size,fps,clips,view,name,sourceId,onProgress,signal}){
  if(!frames.length||frames.length>720)throw Error('每次请生成 1–720 帧');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const worker=new Worker(new URL('./gif.worker.js',import.meta.url),{type:'module'}),files={},atlasFiles=[];
  const columns=Math.max(1,Math.floor(2048/size)),perPage=columns*columns;
  let atlas,atlasCtx;
  const timing=[];
  try{
    await send(worker,{type:'start'});
    for(let index=0;index<frames.length;index++){
      signal?.throwIfAborted();onProgress?.(`编码 GIF 与图集 ${index+1} / ${frames.length}`);
      const bitmap=await createImageBitmap(frames[index]);ctx.clearRect(0,0,size,size);ctx.drawImage(bitmap,0,0);
      const pixels=ctx.getImageData(0,0,size,size).data;await send(worker,{type:'frame',pixels:pixels.buffer,size,delay:1000/fps},[pixels.buffer]);
      const frameName=`frames/frame-${String(index).padStart(4,'0')}.png`;files[frameName]=new Uint8Array(await frames[index].arrayBuffer());
      const page=Math.floor(index/perPage),cell=index%perPage;
      if(cell===0){atlas=document.createElement('canvas');atlas.width=columns*size;atlas.height=Math.ceil(Math.min(perPage,frames.length-index)/columns)*size;atlasCtx=atlas.getContext('2d');}
      const x=(cell%columns)*size,y=Math.floor(cell/columns)*size;atlasCtx.drawImage(bitmap,x,y);bitmap.close();
      timing.push({file:frameName,page,x,y,width:size,height:size,durationMs:1000/fps,anchor:{x:size/2,y:size}});
      if(cell===perPage-1||index===frames.length-1){const blob=await png(atlas),path=`atlas/page-${page}.png`;files[path]=new Uint8Array(await blob.arrayBuffer());atlasFiles.push({path,width:atlas.width,height:atlas.height});}
    }
    const encoded=await send(worker,{type:'finish'}),gif=new Blob([encoded.bytes],{type:'image/gif'});
    const metadata={schema:1,name,sourceId,size,fps,frameCount:frames.length,clips,view,atlases:atlasFiles,frames:timing,background:'transparent',quality:'待查看',createdAt:new Date().toISOString()};
    const json=new Blob([JSON.stringify(metadata,null,2)+'\n'],{type:'application/json'});
    files['animation.gif']=encoded.bytes;files['frames.json']=strToU8(JSON.stringify(metadata,null,2));
    files['preview.html']=strToU8('<!doctype html><meta charset="utf-8"><title>序列帧预览</title><style>body{background:#edf0e9;font:16px system-ui;text-align:center;padding:48px}img{max-width:90vw;background:conic-gradient(#dde1d7 25%,#f2f4ef 0 50%,#dde1d7 0 75%,#f2f4ef 0) 0/24px 24px}</style><h1>序列帧预览</h1><img src="animation.gif" alt="动作预览"><p>原始 PNG、图集与时间/锚点记录均保存在本包中。</p>');
    onProgress?.('打包原始 PNG、图集和离线预览…');
    const zipped=await archive(files);
    return {gif,json,poster:frames[0],zip:new Blob([zipped],{type:'application/zip'}),metadata};
  }finally{worker.terminate();}
}
