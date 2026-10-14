import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {Focus,Play,Pause,Box,LoaderCircle} from 'lucide-react';
import {captureViewFrames} from '../src/capture-view.js';

export default function Stage({gltf,clipIndex=-1,frameMode=false,onControls,onPoster,view,onView,compact=false}){
  const host=useRef(null),world=useRef(null),callbacks=useRef({}),[error,setError]=useState(''),[paused,setPaused]=useState(false);
  callbacks.current={onControls,onPoster,onView};
  useEffect(()=>{
    if(!gltf||!host.current)return;
    const el=host.current;let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});}catch{setError('当前浏览器无法使用 WebGL，请在支持 3D 的浏览器中打开');return;}
    setError('');renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.01,200);
    scene.add(new THREE.HemisphereLight(0xffffff,0x9ca995,2.1));
    const key=new THREE.DirectionalLight(0xfff7ea,3.2);key.position.set(3,6,4);scene.add(key);
    const fill=new THREE.DirectionalLight(0xe8f0ff,1.4);fill.position.set(-4,3,-2);scene.add(fill);
    const root=clone(gltf.scene);root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(root);if(bounds.isEmpty())root.traverse(node=>bounds.expandByPoint(node.getWorldPosition(new THREE.Vector3())));const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const scale=2/Math.max(size.y,size.x*.7,size.z*.7,.01),holder=new THREE.Group();holder.userData.workbenchCharacter=true;holder.add(root);holder.scale.setScalar(scale);holder.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);scene.add(holder);
    let meshes=0,bones=0;root.traverse(n=>{if(n.isMesh)meshes++;if(n.isBone)bones++;});const helper=!meshes&&bones?new THREE.SkeletonHelper(root):null;if(helper){helper.material.color.set(0x7b9860);scene.add(helper);}
    if(!frameMode){const grid=new THREE.GridHelper(10,30,0xbdc8b8,0xd4dbcf);grid.material.transparent=true;grid.material.opacity=.24;scene.add(grid);}
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.8;controls.maxDistance=25;
    const radius=Math.max(size.length()*scale/2,.6);
    const reset=()=>{camera.fov=33;const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(camera.aspect,1)),distance=radius/Math.sin(halfFov)*1.1;controls.target.set(0,size.y*scale/2,0);camera.position.copy(controls.target).add(new THREE.Vector3(2.7,.6,4.2).normalize().multiplyScalar(distance));camera.updateProjectionMatrix();controls.update();};
    reset();if(view){camera.position.fromArray(view.position);camera.fov=view.fov;controls.target.fromArray(view.target);controls.update();camera.updateProjectionMatrix();}
    const snapshot=()=>({position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov});
    controls.addEventListener('end',()=>callbacks.current.onView?.(snapshot()));
    let firstResize=true;const resize=new ResizeObserver(()=>{const w=Math.max(el.clientWidth,1),h=Math.max(el.clientHeight,1);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(firstResize&&!view)reset();firstResize=false;});resize.observe(el);
    const mixer=new THREE.AnimationMixer(root);let action,playing=true;
    const select=index=>{mixer.stopAllAction();root.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.pose();});action=gltf.animations[index]?mixer.clipAction(gltf.animations[index]).reset().play():null;};select(clipIndex);
    const zoom=factor=>{const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(factor);camera.position.copy(controls.target).add(offset);controls.update();callbacks.current.onView?.(snapshot());};
    const angle=degrees=>{const delta=camera.position.clone().sub(controls.target),radius=Math.hypot(delta.x,delta.z),r=THREE.MathUtils.degToRad(degrees);camera.position.copy(controls.target).add(new THREE.Vector3(Math.sin(r)*radius,delta.y,Math.cos(r)*radius));controls.update();callbacks.current.onView?.(snapshot());};
    const capture=options=>captureViewFrames({scene,camera,root,clip:gltf.animations[options.clipIndex],view:snapshot(),...options});
    world.current={select,reset,zoom,angle,mixer,get action(){return action;},setPlaying:value=>{playing=value;}};
    callbacks.current.onControls?.({capture,zoom,angle,reset,getView:snapshot});
    let frame,disposed=false,first=true,last=performance.now();
    function draw(){if(disposed)return;frame=requestAnimationFrame(draw);const now=performance.now();if(playing&&!document.hidden)mixer.update(Math.min((now-last)/1000,.1));last=now;controls.update();renderer.render(scene,camera);if(first){first=false;renderer.domElement.toBlob(blob=>{if(blob&&!disposed)callbacks.current.onPoster?.(blob);},'image/png');}}
    draw();
    return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();controls.dispose();mixer.stopAllAction();mixer.uncacheRoot(root);helper?.geometry.dispose();helper?.material.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();world.current=null;callbacks.current.onControls?.(null);};
  },[gltf,frameMode]);
  useEffect(()=>{world.current?.select(clipIndex);setPaused(false);world.current?.setPlaying(true);},[clipIndex]);
  return <div className={`model-stage ${frameMode?'frame-stage':''} ${compact?'compact':''}`}>
    <div ref={host} className="stage-host"/>
    {!gltf&&<div className="stage-placeholder"><Box size={46} strokeWidth={.8}/><span>选择一个模型开始</span></div>}
    {error&&<div className="stage-error">{error}</div>}
    {gltf&&<div className="stage-toolbar"><span>拖动旋转 · 滚轮缩放</span><div>{clipIndex>=0&&<button aria-label={paused?'播放动作':'暂停动作'} onClick={()=>{world.current?.setPlaying(paused);setPaused(!paused);}}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>}<button aria-label="恢复视角" onClick={()=>world.current?.reset()}><Focus size={15}/></button></div></div>}
  </div>;
}
