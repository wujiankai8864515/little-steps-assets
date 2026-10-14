import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {zipSync} from 'fflate';
import {readGlb} from './glb.js';

export function loader(manager){return new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);}
export async function parseModel(bytes){return loader().parseAsync(bytes instanceof Uint8Array?bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength):bytes,'');}
export function modelInfo(gltf){
  let triangles=0,vertices=0;const bones=new Set(),images=new Set();
  gltf.scene.traverse(node=>{
    if(node.isBone)bones.add(node.name);
    if(node.isMesh){const g=node.geometry;vertices+=g.attributes.position?.count||0;triangles+=(g.index?.count||g.attributes.position?.count||0)/3;}
    for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)for(const value of Object.values(material))if(value?.isTexture)images.add(value.source?.uuid||value.uuid);
  });
  return {triangles:Math.round(triangles),vertices,boneCount:bones.size,textureCount:images.size,animations:gltf.animations.map((c,index)=>({index,name:c.name||`动作 ${index+1}`,duration:c.duration}))};
}
export function disposeModel(scene){scene?.traverse(node=>{node.geometry?.dispose();for(const mat of Array.isArray(node.material)?node.material:[node.material])if(mat){for(const v of Object.values(mat))if(v?.isTexture)v.dispose();mat.dispose();}});}
export async function importModel(files){
  const list=Array.from(files),primary=list.find(f=>/\.(glb|gltf|fbx)$/i.test(f.name));
  if(!primary)throw Error('请选择 GLB、FBX 或包含 glTF 的完整文件夹');
  const urls=new Map(),paths=new Map();
  for(const file of list){const path=file.webkitRelativePath||file.name;paths.set(path,file);}
  const rootPath=primary.webkitRelativePath||primary.name,base=rootPath.includes('/')?rootPath.slice(0,rootPath.lastIndexOf('/')+1):'';
  const resolvePath=url=>{
    if(url.startsWith('data:')||url.startsWith('blob:'))return url;
    if(/^https?:\/\//i.test(url))throw Error('素材引用了外部网址，请先带齐贴图和缓冲文件');
    let path=decodeURIComponent(url.replace(/^\.\//,'')),file=paths.get(path)||paths.get(base+path);
    if(!file){const matches=list.filter(f=>f.name===path.split('/').at(-1));if(matches.length===1)file=matches[0];}
    if(!file)throw Error(`缺少依赖文件：${path}。请导入完整文件夹。`);
    if(!urls.has(file))urls.set(file,URL.createObjectURL(file));return urls.get(file);
  };
  const manager=new THREE.LoadingManager();manager.setURLModifier(resolvePath);
  let started=false,loadError,finishLoads;
  const completedLoads=new Promise(resolve=>finishLoads=resolve);
  manager.onStart=()=>{started=true;};manager.onLoad=()=>finishLoads();manager.onError=url=>{loadError=Error(`依赖读取失败，请带齐贴图：${url.startsWith('blob:')?'素材内嵌文件':url}`);};
  try{
    let bytes=await primary.arrayBuffer(),gltf;
    if(/\.glb$/i.test(primary.name)){readGlb(bytes);gltf=await loader(manager).parseAsync(bytes,'');}
    else if(/\.gltf$/i.test(primary.name)){
      const json=JSON.parse(new TextDecoder().decode(bytes));gltf=await loader(manager).parseAsync(JSON.stringify(json),'');
      bytes=await new GLTFExporter().parseAsync(gltf.scene,{binary:true,animations:gltf.animations,onlyVisible:false,includeCustomExtensions:true});
    }else{
      const scene=new FBXLoader(manager).parse(bytes,'');
      if(started)await completedLoads;if(loadError)throw loadError;gltf={scene,animations:scene.animations||[]};
      bytes=await new GLTFExporter().parseAsync(scene,{binary:true,animations:gltf.animations,onlyVisible:false,includeCustomExtensions:true});
    }
    let original=null;
    if(list.length>1){const entries={};for(const file of list)entries[file.webkitRelativePath||file.name]=new Uint8Array(await file.arrayBuffer());original=new Blob([zipSync(entries,{level:0})],{type:'application/zip'});}
    else if(!/\.glb$/i.test(primary.name))original=primary;
    return {bytes,blob:new Blob([bytes],{type:'model/gltf-binary'}),gltf,info:modelInfo(gltf),original,originalName:list.length>1?'original-source.zip':primary.name};
  }finally{for(const url of urls.values())URL.revokeObjectURL(url);}
}
