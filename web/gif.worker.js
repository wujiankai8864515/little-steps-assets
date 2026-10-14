import {GIFEncoder,quantize,applyPalette} from 'gifenc';
let gif;
self.onmessage=({data})=>{
  try{
    if(data.type==='start'){gif=GIFEncoder();self.postMessage({type:'ready'});return;}
    if(data.type==='frame'){
      const rgba=new Uint8Array(data.pixels),palette=quantize(rgba,255,{format:'rgba4444',oneBitAlpha:127});
      let transparentIndex=palette.findIndex(p=>p[3]===0);
      if(transparentIndex<0){transparentIndex=palette.length;palette.push([0,0,0,0]);}
      const indexed=applyPalette(rgba,palette,'rgba4444');
      // Always reserve an explicit transparent color for disposal between frames.
      for(let i=0;i<indexed.length;i++)if(rgba[i*4+3]<128)indexed[i]=transparentIndex;
      gif.writeFrame(indexed,data.size,data.size,{palette,transparent:true,transparentIndex,dispose:2,delay:data.delay,repeat:0});
      self.postMessage({type:'frame'});return;
    }
    if(data.type==='finish'){gif.finish();const bytes=gif.bytes();self.postMessage({type:'done',bytes},[bytes.buffer]);gif=null;}
  }catch(e){self.postMessage({type:'error',message:e.message});}
};
