import {Matrix4,Quaternion,Vector3} from 'three';

// Browser port of server/glb.mjs. Animation composition preserves the original
// target binary: meshes, skin weights, embedded images and materials stay intact.
export function readGlb(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.byteLength<20)throw Error('GLB 文件不完整');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length)throw Error('需要完整的 glTF 2.0 GLB 文件');
  let json,bin=new Uint8Array();
  for(let offset=12;offset<bytes.length;){
    if(offset+8>bytes.length)throw Error('GLB 数据不完整');
    const count=view.getUint32(offset,true),type=view.getUint32(offset+4,true);
    if(offset+8+count>bytes.length)throw Error('GLB 数据不完整');
    const chunk=bytes.subarray(offset+8,offset+8+count);
    if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(chunk));
    if(type===0x004e4942)bin=chunk;
    offset+=8+count;
  }
  if(!json||json.buffers?.some(b=>b.uri))throw Error('请导入完整 glTF 文件夹，或使用内嵌贴图的 GLB');
  if(json.images?.some(i=>i.uri&&!i.uri.startsWith('data:')))throw Error('GLB 的贴图在外部，请导入含贴图的完整文件夹');
  return {json,bin};
}
export function writeGlb(json,bin){
  const value=structuredClone(json);value.buffers=[{byteLength:bin.length}];
  const raw=new TextEncoder().encode(JSON.stringify(value)),jsonSize=Math.ceil(raw.length/4)*4,binSize=Math.ceil(bin.length/4)*4;
  const result=new Uint8Array(28+jsonSize+binSize),view=new DataView(result.buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,result.length,true);
  view.setUint32(12,jsonSize,true);view.setUint32(16,0x4e4f534a,true);
  result.fill(32,20,20+jsonSize);result.set(raw,20);
  view.setUint32(20+jsonSize,binSize,true);view.setUint32(24+jsonSize,0x004e4942,true);result.set(bin,28+jsonSize);
  return result;
}
function restSignature(glb){
  const nodes=glb.json.nodes||[],parents=new Map(),worlds=new Map();
  nodes.forEach((node,index)=>(node.children||[]).forEach(child=>parents.set(child,index)));
  function world(index){
    if(worlds.has(index))return worlds.get(index);
    const node=nodes[index];
    let matrix=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3(...(node.translation||[0,0,0])),new Quaternion(...(node.rotation||[0,0,0,1])),new Vector3(...(node.scale||[1,1,1])));
    if(parents.has(index))matrix=world(parents.get(index)).clone().multiply(matrix);
    worlds.set(index,matrix);return matrix;
  }
  let joints=[...new Set((glb.json.skins||[]).flatMap(s=>s.joints))];
  if(!joints.length){const boneNames=nodes.flatMap(n=>n.extras?.workbenchBoneNames||[]);joints=nodes.flatMap((n,i)=>boneNames.includes(n.name)?[i]:[]);}
  const rows=joints.map(i=>({name:nodes[i].name||`node_${i}`,parent:joints.includes(parents.get(i))?nodes[parents.get(i)].name:null,world:world(i).toArray().map(n=>Math.round(n*100000)/100000)})).sort((a,b)=>a.name.localeCompare(b.name));
  return rows.length?JSON.stringify(rows):null;
}
export function selectAnimations(bytes,indices){
  const input=readGlb(bytes),json=structuredClone(input.json),clips=json.animations||[];
  if(indices.some(i=>!Number.isInteger(i)||!clips[i]))throw Error('所选动作不存在');
  json.animations=indices.map(i=>clips[i]);
  if(!json.animations.length)delete json.animations;
  return writeGlb(json,input.bin);
}
export function composeExact(bytes,selections){
  const target=readGlb(bytes),json=structuredClone(target.json),parts=[target.bin],signature=restSignature(target);
  let offset=target.bin.length;json.animations=[];
  const names=new Map();(json.nodes||[]).forEach((n,i)=>{if(n.name)names.set(n.name,names.has(n.name)?-1:i);});
  for(const pick of selections){
    const source=readGlb(pick.bytes),animation=source.json.animations?.[pick.index];
    if(!animation)throw Error('所选动作片段已经不存在');
    if(pick.isTarget){json.animations.push(structuredClone(animation));continue;}
    if(!signature||signature!==restSignature(source))throw Error('动作与模型的静止骨架不同。请在 Mixamo 或 Blender 中适配后导回；原模型保持完整。');
    const views=new Map(),accessors=new Map();
    const copyView=id=>{
      if(views.has(id))return views.get(id);
      const view=source.json.bufferViews[id];
      if((view.buffer||0)!==0||view.extensions)throw Error('压缩动画需要先在 Blender 中标准化');
      const pad=(4-offset%4)%4;if(pad){parts.push(new Uint8Array(pad));offset+=pad;}
      const part=source.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),index=(json.bufferViews??=[]).length;
      json.bufferViews.push({...view,buffer:0,byteOffset:offset});parts.push(part);offset+=part.length;views.set(id,index);return index;
    };
    const copyAccessor=id=>{
      if(accessors.has(id))return accessors.get(id);
      const value=structuredClone(source.json.accessors[id]);
      if(value.bufferView!==undefined)value.bufferView=copyView(value.bufferView);
      if(value.sparse){value.sparse.indices.bufferView=copyView(value.sparse.indices.bufferView);value.sparse.values.bufferView=copyView(value.sparse.values.bufferView);}
      const index=json.accessors.length;json.accessors.push(value);accessors.set(id,index);return index;
    };
    const copy=structuredClone(animation);
    for(const channel of copy.channels){const node=source.json.nodes[channel.target.node],index=names.get(node?.name);if(index===undefined||index===-1||channel.target.path==='weights')throw Error('这个动作含无法唯一匹配的节点或表情曲线，需要专门适配');channel.target.node=index;}
    copy.samplers=copy.samplers.map(s=>({...s,input:copyAccessor(s.input),output:copyAccessor(s.output)}));json.animations.push(copy);
  }
  const bin=new Uint8Array(offset);let start=0;for(const part of parts){bin.set(part,start);start+=part.length;}
  return writeGlb(json,bin);
}
