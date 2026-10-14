import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

// Clone the visible scene and bones so capture never changes the user's live animation or camera.
export async function captureViewFrames({scene,camera,root,clip,view,size,fps,signal,onProgress}){
  if(!clip)throw Error('请选择一个已有动作');
  const count=Math.max(1,Math.ceil(clip.duration*fps-1e-4));if(count>720)throw Error('本段动作超过 720 帧，请降低帧率');
  // SkeletonHelper needs its original root in its constructor, so omit UI-only helpers before cloning.
  const snapshot=scene.clone(false),capturedCamera=camera.clone();
  for(const child of scene.children){
    if(child.userData.workbenchCharacter){const holder=child.clone(false);holder.add(cloneSkeleton(root));snapshot.add(holder);}
    else if(!child.isSkeletonHelper)snapshot.add(child.clone());
  }
  const holder=snapshot.children.find(n=>n.userData.workbenchCharacter),capturedRoot=holder?.children[0];if(!capturedRoot)throw Error('模型尚未准备好');
  const helper=holder.children.find(n=>n.isSkeletonHelper);if(helper)holder.remove(helper);
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.setSize(size,size,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  capturedCamera.position.fromArray(view.position);capturedCamera.lookAt(new THREE.Vector3(...view.target));capturedCamera.fov=view.fov;capturedCamera.aspect=1;capturedCamera.updateProjectionMatrix();
  const mixer=new THREE.AnimationMixer(capturedRoot),action=mixer.clipAction(clip).play(),frames=[];
  try {
    for(let i=0;i<count;i++){
      signal?.throwIfAborted();action.time=Math.min(i/fps,Math.max(0,clip.duration-1e-6));mixer.update(0);renderer.render(snapshot,capturedCamera);
      const blob=await new Promise((resolve,reject)=>renderer.domElement.toBlob(b=>b?resolve(b):reject(Error('无法捕获当前画面')),'image/png'));
      frames.push(blob);onProgress?.(i+1,count);
    }
    signal?.throwIfAborted();return frames;
  } finally {
    mixer.stopAllAction();mixer.uncacheRoot(capturedRoot);
    // Geometries, textures and materials are shared with the live viewer; only release capture targets.
    snapshot.traverse(n=>{if(n.isLight){n.shadow?.map?.dispose();n.shadow?.mapPass?.dispose();}});
    renderer.dispose();renderer.forceContextLoss();
  }
}
