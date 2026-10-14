import fs from 'node:fs';
import crypto from 'node:crypto';
import {Matrix4,Quaternion,Vector3} from 'three';
export const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
export function readGlb(file){
 const b=Buffer.isBuffer(file)?file:fs.readFileSync(file);
 if(b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)throw Error('需要完整的 glTF 2.0 GLB 文件');
 let json,bin=Buffer.alloc(0);for(let i=12;i<b.length;){let n=b.readUInt32LE(i),t=b.readUInt32LE(i+4);if(i+8+n>b.length)throw Error('GLB 数据不完整');if(t===0x4e4f534a)json=JSON.parse(b.subarray(i+8,i+8+n).toString());else if(t===0x004e4942)bin=b.subarray(i+8,i+8+n);i+=8+n;}
 if(!json||json.buffers?.some(x=>x.uri))throw Error('GLB 存在外部缓冲，请先导入完整源文件包');return {json,bin};
}
export function writeGlb(file,json,bin){
 json.buffers=[{byteLength:bin.length}];let j=Buffer.from(JSON.stringify(json));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);let body=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);let h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+body.length,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4e4f534a,16);let bh=Buffer.alloc(8);bh.writeUInt32LE(body.length,0);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(file,Buffer.concat([h,j,bh,body]));
}
export function removeAnimations(input,indices,out) {
 const g=readGlb(input),removed=new Set(indices),clips=g.json.animations||[];
 if(!removed.size||[...removed].some(i=>!Number.isInteger(i)||!clips[i]))throw Error('要删除的动作片段不存在');
 const kept=clips.map((_,i)=>i).filter(i=>!removed.has(i));
 g.json.animations=kept.map(i=>clips[i]);
 if(!g.json.animations.length)delete g.json.animations;
 // The original binary, meshes, materials, skin and image data stay byte-for-byte intact.
 writeGlb(out,g.json,g.bin);
 return {geometryPreserved:true,mode:'remove-animation-references',keptIndices:kept,removedIndices:[...removed]};
}
const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
export function values(g,id){const a=g.json.accessors[id];if(a.sparse||a.componentType!==5126)throw Error('此动画数据需要先在 Blender 中标准化');const v=g.json.bufferViews[a.bufferView];const n=sizes[a.type];let res=[];for(let i=0;i<a.count;i++)for(let k=0;k<n;k++)res.push(g.bin.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*4)+k*4));return res;}
function worlds(g){const nodes=g.json.nodes||[],parents=new Map;nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));let cache=new Map;function mat(i){if(cache.has(i))return cache.get(i);const n=nodes[i];let m=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...(n.translation||[0,0,0])),new Quaternion(...(n.rotation||[0,0,0,1])),new Vector3(...(n.scale||[1,1,1])));if(parents.has(i))m=mat(parents.get(i)).clone().multiply(m);cache.set(i,m);return m;}nodes.forEach((_,i)=>mat(i));return {cache,parents};}
export function rig(g){const {cache,parents}=worlds(g),names=g.json.nodes||[];let joints=[...new Set((g.json.skins||[]).flatMap(s=>s.joints))];if(!joints.length){const boneNames=names.flatMap(n=>n.extras?.workbenchBoneNames||[]);joints=names.flatMap((n,i)=>boneNames.includes(n.name)?[i]:[]);}const rows=joints.map(i=>({name:names[i].name||`node_${i}`,parent:joints.includes(parents.get(i))?names[parents.get(i)].name:null,world:cache.get(i).toArray().map(n=>Math.round(n*100000)/100000)})).sort((a,b)=>a.name.localeCompare(b.name));return {signature:rows.length?hash(JSON.stringify(rows)):null,bones:rows,indices:joints};}
export function inspect(file){const g=readGlb(file),j=g.json,r=rig(g);let triangles=0,vertices=0;for(const m of j.meshes||[])for(const p of m.primitives||[]){vertices+=j.accessors[p.attributes.POSITION]?.count||0;if((p.mode??4)===4)triangles+=(j.accessors[p.indices]?.count||j.accessors[p.attributes.POSITION]?.count||0)/3;}
 const animations=(j.animations||[]).map((a,i)=>{let t=a.samplers.flatMap(s=>values(g,s.input));return {index:i,name:a.name||`动作 ${i+1}`,duration:Math.max(0,...t)-Math.min(0,...t),reference:/t[-_ ]?pose|a[-_ ]?pose|rest.?pose/i.test(a.name||'')};});
 const textures=(j.images||[]).map((im,i)=>({index:i,name:im.name||`贴图 ${i+1}`,mime:im.mimeType||'image/png'}));return {triangles,vertices,bones:r.bones,rigSignature:r.signature,boneCount:r.bones.length,animations,textures,bytes:fs.statSync(file).size};
}
export class NeedsInput extends Error{}
export function composeExact(targetFile,selections,out){
 const target=readGlb(targetFile),j=structuredClone(target.json),parts=[target.bin];let offset=target.bin.length;j.animations=[];const tgtRig=rig(target);if(!tgtRig.signature)throw new NeedsInput('这个模型还没有骨架。请先导出 FBX，到 Mixamo 或 AccuRIG 绑定后导回。');
 const byName=new Map;(j.nodes||[]).forEach((n,i)=>{if(n.name)byName.set(n.name,byName.has(n.name)?-1:i);});const names=new Set;
 for(const pick of selections){const src=readGlb(pick.file),s=src.json,a=s.animations?.[pick.index];if(!a)throw Error('所选动作片段已不存在');if(rig(src).signature!==tgtRig.signature)throw new NeedsInput('所选动作与目标的静止骨架不同。请先使用 Mixamo、AccuRIG 或 Blender 重定向，再将适配结果导回此任务。没有修改目标模型。');
   const accessorMap=new Map,viewMap=new Map;
   function copyView(id){if(viewMap.has(id))return viewMap.get(id);const v=s.bufferViews[id];if((v.buffer||0)!==0||v.extensions)throw new NeedsInput('压缩动画缓冲需要 Blender 标准化');const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}const b=src.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);const dest=(j.bufferViews??=[]).length;j.bufferViews.push({...v,buffer:0,byteOffset:offset});parts.push(b);offset+=b.length;viewMap.set(id,dest);return dest;}
   function copyAccess(id){if(accessorMap.has(id))return accessorMap.get(id);const v=structuredClone(s.accessors[id]);if(v.bufferView!==undefined)v.bufferView=copyView(v.bufferView);if(v.sparse){v.sparse.indices.bufferView=copyView(v.sparse.indices.bufferView);v.sparse.values.bufferView=copyView(v.sparse.values.bufferView);}const dest=j.accessors.length;j.accessors.push(v);accessorMap.set(id,dest);return dest;}
   const result=structuredClone(a);let name=pick.name||a.name||'动作';let suffix=2;while(names.has(name))name=`${pick.name||a.name} ${suffix++}`;names.add(name);result.name=name;
   for(const c of result.channels){const n=s.nodes[c.target.node],idx=byName.get(n?.name);if(idx===undefined||idx===-1||c.target.path==='weights')throw new NeedsInput('动作包含无法唯一匹配的节点或表情曲线，需要专门适配');c.target.node=idx;}
   result.samplers=result.samplers.map(v=>({...v,input:copyAccess(v.input),output:copyAccess(v.output)}));j.animations.push(result);
 }
 writeGlb(out,j,Buffer.concat(parts));return {geometryPreserved:true,mode:'exact-skeleton',clips:j.animations.length};
}
