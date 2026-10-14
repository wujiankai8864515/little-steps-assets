import {readGlb,writeGlb} from './glb.mjs';

// A light clip with the exact target node hierarchy. Geometry and textures stay in the browser.
export function exportAnimationClip(input, index, output) {
  const {json:src,bin}=readGlb(input),animation=structuredClone(src.animations?.[index]);
  if(!animation)throw Error('动作片段不存在');
  const json={asset:{version:'2.0',generator:'AssetWorkbench motion preview'},scene:src.scene||0,scenes:structuredClone(src.scenes||[{nodes:[0]}]),nodes:src.nodes.map(n=>Object.fromEntries(Object.entries(n).filter(([k])=>['name','children','matrix','translation','rotation','scale','extras'].includes(k)))),skins:(src.skins||[]).map(s=>({joints:s.joints,...(s.skeleton!==undefined?{skeleton:s.skeleton}:{}),...(s.name?{name:s.name}:{})})),accessors:[],bufferViews:[],animations:[animation]};
  const parts=[],accessors=new Map(),views=new Map();let offset=0;
  function view(id){if(views.has(id))return views.get(id);const v=src.bufferViews[id];if((v.buffer||0)!==0||v.extensions)throw Error('此动作需要先标准化');const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}const b=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength),dest=json.bufferViews.length;json.bufferViews.push({...v,byteOffset:offset,buffer:0});parts.push(b);offset+=b.length;views.set(id,dest);return dest;}
  function accessor(id){if(accessors.has(id))return accessors.get(id);const a=structuredClone(src.accessors[id]);if(a.bufferView!==undefined)a.bufferView=view(a.bufferView);if(a.sparse){a.sparse.indices.bufferView=view(a.sparse.indices.bufferView);a.sparse.values.bufferView=view(a.sparse.values.bufferView);}const dest=json.accessors.length;json.accessors.push(a);accessors.set(id,dest);return dest;}
  for(const s of animation.samplers){s.input=accessor(s.input);s.output=accessor(s.output);}
  writeGlb(output,json,Buffer.concat(parts));
}
