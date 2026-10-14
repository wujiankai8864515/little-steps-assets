import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Play,Pause,RotateCcw,ScanLine,Bone,Maximize2,LoaderCircle,Focus} from 'lucide-react';
import {SelectField,Tip} from './components/ui.jsx';
import {motionName,rawMotionName} from './motion-labels.js';
import {captureViewFrames} from './capture-view.js';

const clipCache=new Map();
function loadPreviewClip(url){
  if(!clipCache.has(url)){
    const promise=new Promise((resolve,reject)=>new GLTFLoader().load(url,g=>{if(!g.animations[0])return reject(Error('试播片段为空'));resolve(g.animations[0]);},undefined,reject));
    clipCache.set(url,promise);promise.catch(()=>clipCache.delete(url));
    if(clipCache.size>40)clipCache.delete(clipCache.keys().next().value);
  }
  return clipCache.get(url);
}
export function playbackTime(clock,duration){return duration>0?((clock.time+(clock.playing?(performance.now()-clock.stamp)/1000:0))%duration+duration)%duration:0;}

export default function Viewer({asset,clipIndex=0,onClip,advanced=false,animationPreview=null,syncPlayback=null,hidePlayback=false,onReady,onPreviewReady,reloadKey=0,frameMode=false,initialView=null,onViewChange,onViewInteraction,onControlsReady,suspended=false,allowedClipIndices=null,embedded=false,hideToolbar=false,showClipSelector=true,staticPreview=false,playSignal=0,geometryAsset=null,initialPlayback=null,onPlaybackChange,poster=false,onPosterReady}) {
  const host=useRef(),stage=useRef(),world=useRef(),playing=useRef(initialPlayback?.paused!==true),desiredClip=useRef(clipIndex),restoredPlayback=useRef(false);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[paused,setPaused]=useState(initialPlayback?.paused===true),[wire,setWire]=useState(false),[bones,setBones]=useState(false),[time,setTime]=useState(0);
  const visualAsset=geometryAsset||asset;
  const preview=animationPreview||(visualAsset?.id!==asset?.id&&clipIndex>=0?{id:asset.id+':'+clipIndex,url:'/api/assets/'+asset.id+'/clip/'+clipIndex,duration:asset.metadata.animations[clipIndex]?.duration,displayName:motionName(rawMotionName(asset.metadata.animations[clipIndex]||{},asset))}:null);
  const isGlb=visualAsset?.file?.toLowerCase().endsWith('.glb');
  const callbacks=useRef({});callbacks.current={onReady,onPreviewReady,onViewChange,onViewInteraction,onControlsReady,onPlaybackChange,onPosterReady};
  desiredClip.current=clipIndex;
  const suspendedRef=useRef(suspended);suspendedRef.current=suspended;
  useEffect(()=>{
    if(!host.current||!isGlb)return;
    setReady(false);setError('');setTime(0);callbacks.current.onReady?.(false);
    const el=host.current;let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}
    catch{const message='浏览器暂未提供 WebGL，请启用硬件加速后重新打开';setError(message);callbacks.current.onReady?.(false,message);return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    let needsDraw=true;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.01,80);
    scene.add(new THREE.HemisphereLight(0xf2f4ff,0x9ba28d,2.1));
    const key=new THREE.DirectionalLight(0xfff8ec,3.2);
    key.position.set(3,6,4);key.castShadow=true;
    key.shadow.mapSize.set(2048,2048);
    key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=4;key.shadow.camera.bottom=-2;key.shadow.camera.near=.1;key.shadow.camera.far=18;
    key.shadow.bias=-.0003;key.shadow.normalBias=.018;key.shadow.radius=4;
    scene.add(key);
    const fill=new THREE.DirectionalLight(0xe7f1ff,1.5);fill.position.set(-4,3,-2);scene.add(fill);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({color:0x425037,opacity:.15}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.007;floor.receiveShadow=true;scene.add(floor);
    const grid=new THREE.GridHelper(10,50,0xbfcab4,0xcbd5c0);
    grid.material.transparent=true;grid.material.opacity=.24;grid.material.depthWrite=false;
    grid.position.y=-.005;scene.add(grid);
    floor.visible=grid.visible=!frameMode;
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.addEventListener('change',()=>{needsDraw=true;});
    controls.enableDamping=true;controls.dampingFactor=.07;controls.maxPolarAngle=Math.PI*.51;controls.minDistance=1.1;controls.maxDistance=15;
    function resetCamera(){camera.position.set(1.75,1.6,4.3);controls.target.set(0,.83,0);controls.update();}
    resetCamera();
    if(frameMode&&initialView){camera.position.fromArray(initialView.position);controls.target.fromArray(initialView.target);camera.fov=initialView.fov;controls.update();}
    const viewSnapshot=()=>({position:camera.position.toArray().map(v=>+v.toFixed(6)),target:controls.target.toArray().map(v=>+v.toFixed(6)),fov:camera.fov});
    let viewTimer;function reportView(){clearTimeout(viewTimer);viewTimer=setTimeout(()=>{if(!gone&&world.current)callbacks.current.onViewChange?.(viewSnapshot());},220);}
    if(frameMode){controls.addEventListener('change',()=>{callbacks.current.onViewInteraction?.();reportView();});controls.addEventListener('start',()=>callbacks.current.onViewInteraction?.());controls.addEventListener('end',reportView);}
    const resize=new ResizeObserver(()=>{
      const w=Math.max(el.clientWidth,1),h=Math.max(el.clientHeight,1);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();needsDraw=true;
    });
    resize.observe(el);
    let gone=false,raf,mixer,action,root,helper;const clock=new THREE.Clock();
    const disposeObject=o=>o?.traverse(n=>{n.geometry?.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])if(m){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});
    new GLTFLoader().load('/files/'+visualAsset.file,g=>{
      if(gone){disposeObject(g.scene);return;}
      root=g.scene;
      root.traverse(o=>{
        if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}
        for(const m of Array.isArray(o.material)?o.material:[o.material]) {
          // This imported body material has unintended slight alpha. Preserve actual transparent materials elsewhere.
          if(m?.name==='Designer_Logic_PBR'&&m.transparent){m.transparent=false;m.depthWrite=true;m.opacity=1;m.needsUpdate=true;}
        }
      });
      const box=new THREE.Box3().setFromObject(root);
      if(box.isEmpty()){root.updateMatrixWorld(true);root.traverse(o=>box.expandByPoint(o.getWorldPosition(new THREE.Vector3())));}
      const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=2/Math.max(size.y,.01);
      const group=new THREE.Group();group.userData.workbenchCharacter=true;group.add(root);group.scale.setScalar(scale);group.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);scene.add(group);
      helper=new THREE.SkeletonHelper(root);helper.visible=!visualAsset.metadata.vertices;group.add(helper);
      mixer=new THREE.AnimationMixer(root);
      function select(i){mixer.stopAllAction();action=g.animations[i]?mixer.clipAction(g.animations[i]).reset().play():null;setTime(0);}
      function playClip(clip){mixer.stopAllAction();action=mixer.clipAction(clip).reset().play();setTime(0);}
      select(preview?-1:desiredClip.current);needsDraw=true;
      world.current={assetId:visualAsset.id,select,playClip,root,helper,action:()=>action,controls,camera,mixer,resetCamera,poster:()=>{mixer.stopAllAction();const c=g.animations[desiredClip.current];if(c){const a=mixer.clipAction(c).reset().play();a.time=c.duration*.25;mixer.update(0);}const w=renderer.domElement.width,h=renderer.domElement.height,aspect=camera.aspect;renderer.setPixelRatio(1);renderer.setSize(320,320,false);camera.aspect=1;camera.updateProjectionMatrix();renderer.render(scene,camera);const png=renderer.domElement.toDataURL("image/png");renderer.setSize(w,h,false);camera.aspect=aspect;camera.updateProjectionMatrix();return png;}};
      setReady(true);callbacks.current.onReady?.(true);
      if(frameMode){callbacks.current.onControlsReady?.({
        capture:options=>{if(gone)throw Error('请等待当前模型载入');return captureViewFrames({scene,camera,root,clip:g.animations[options.clipIndex],...options});},
        zoom:factor=>{callbacks.current.onViewInteraction?.();const delta=camera.position.clone().sub(controls.target);delta.setLength(THREE.MathUtils.clamp(delta.length()*factor,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(delta);controls.update();reportView();},
        angle:degrees=>{callbacks.current.onViewInteraction?.();const delta=camera.position.clone().sub(controls.target),r=Math.hypot(delta.x,delta.z),a=THREE.MathUtils.degToRad(degrees);camera.position.copy(controls.target).add(new THREE.Vector3(Math.sin(a)*r,delta.y,Math.cos(a)*r));controls.update();reportView();},
        reset:()=>{callbacks.current.onViewInteraction?.();resetCamera();reportView();}
      });reportView();}
    },undefined,e=>{if(!gone){setError(e.message||'模型读取失败');callbacks.current.onReady?.(false,e.message||'模型读取失败');}});
    let elapsed=0;
    function frame(){
      if(gone)return;raf=requestAnimationFrame(frame);
      const dt=Math.min(clock.getDelta(),.1);
      if(!document.hidden&&!suspendedRef.current){if(syncPlayback&&action){action.time=playbackTime(syncPlayback.current,action.getClip().duration);mixer.update(0);}else if(playing.current&&!staticPreview)mixer?.update(dt);controls.update();if(!staticPreview||needsDraw){renderer.render(scene,camera);needsDraw=false;}elapsed+=dt;if(!staticPreview&&elapsed>.15){elapsed=0;setTime(action?.time||0);}}
    }
    frame();
    return()=>{gone=true;clearTimeout(viewTimer);callbacks.current.onControlsReady?.(null);cancelAnimationFrame(raf);resize.disconnect();controls.dispose();mixer?.stopAllAction();disposeObject(scene);key.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove();world.current=null;};
  },[visualAsset?.id,reloadKey,frameMode,staticPreview]);
  useEffect(()=>{if(!poster||!ready||world.current?.assetId!==visualAsset?.id)return;let stopped=false;const frame=requestAnimationFrame(()=>{if(!stopped)callbacks.current.onPosterReady?.(world.current.poster());});return()=>{stopped=true;cancelAnimationFrame(frame);};},[poster,ready,visualAsset?.id,clipIndex]);
  useEffect(()=>{if(world.current&&world.current.assetId===visualAsset?.id&&!preview){world.current.select(clipIndex);callbacks.current.onReady?.(true);}},[clipIndex,asset?.id]);
  useEffect(()=>{
    if(!ready||!world.current||world.current.assetId!==visualAsset?.id)return;
    if(!preview){world.current.select(clipIndex);restorePlayback();return;}
    let stale=false;callbacks.current.onPreviewReady?.(false);
    loadPreviewClip(preview.url).then(clip=>{if(!stale&&world.current?.assetId===visualAsset.id){world.current.playClip(clip);restorePlayback();callbacks.current.onPreviewReady?.(true);}}).catch(e=>{if(!stale)callbacks.current.onPreviewReady?.(false,e.message||'试播加载失败');});
    return()=>{stale=true;};
  },[preview?.id,ready,asset?.id]);
  useEffect(()=>{world.current?.root?.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)m.wireframe=wire;});},[wire,ready]);
  useEffect(()=>{if(world.current?.helper)world.current.helper.visible=bones||!asset?.metadata.vertices;},[bones,ready]);
  useEffect(()=>{playing.current=!paused;},[paused]);
  useEffect(()=>{if(!playSignal)return;setPaused(false);playing.current=true;const w=world.current;if(w?.assetId===visualAsset?.id){if(!preview)w.select(clipIndex);else{const a=w.action();if(a){a.time=0;w.mixer.update(0);setTime(0);}}}},[playSignal]);
  function restorePlayback(){if(restoredPlayback.current||animationPreview||!initialPlayback||initialPlayback.clipIndex!==desiredClip.current)return;const w=world.current,a=w?.action();if(!a)return;restoredPlayback.current=true;a.time=Math.min(Math.max(0,initialPlayback.time||0),a.getClip().duration);w.mixer.update(0);setTime(a.time);setPaused(initialPlayback.paused===true);playing.current=initialPlayback.paused!==true;}
  const previewing=useRef(false);previewing.current=!!animationPreview;
  useEffect(()=>{const save=()=>{const w=world.current;if(!w||previewing.current||staticPreview)return;callbacks.current.onPlaybackChange?.({clipIndex:desiredClip.current,time:w.action()?.time||0,paused:!playing.current});};const timer=setInterval(save,2000);addEventListener('pagehide',save);document.addEventListener('visibilitychange',save);return()=>{save();clearInterval(timer);removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',save);};},[staticPreview]);
  useEffect(()=>{if(world.current&&!animationPreview&&!staticPreview)callbacks.current.onPlaybackChange?.({clipIndex,time:world.current.action()?.time||0,paused});},[paused]);
  const clips=(asset?.metadata?.animations||[]).filter(c=>!allowedClipIndices||allowedClipIndices.includes(c.index)),duration=preview?.duration||clips.find(c=>c.index===clipIndex)?.duration||0;
  if(!asset)return <div className="stage empty"><ScanLine size={40} strokeWidth={1}/><h3>从一个模型开始</h3><p>导入已有模型，或从你的作品中选择。</p></div>;
  if(!isGlb)return <div className="stage image-stage">{asset.thumbnail||asset.kind==='image'?<img alt={asset.name} src={'/files/'+(asset.previewGif||asset.thumbnail||asset.file)}/>:<><ScanLine size={44} strokeWidth={1}/><h3>{asset.name}</h3><p>制作已完成，可在下方下载。</p></>}</div>;
  return <div className={'stage '+(frameMode?'frame-stage':'')} ref={stage}>
    {!hideToolbar&&<div className="stage-top"><span className="stage-label">{frameMode?'左键旋转 · 滚轮缩放 · 右键平移':'拖动旋转 · 滚轮缩放'}</span><div className="toggles">
      <Tip text="恢复视角"><button aria-label="恢复视角" onClick={()=>world.current?.resetCamera()}><Focus size={16}/></button></Tip>
      {!frameMode&&!embedded&&<Tip text="全屏预览"><button aria-label="全屏预览" onClick={()=>{const p=document.fullscreenElement?document.exitFullscreen():stage.current?.requestFullscreen();p?.catch(()=>{});}}><Maximize2 size={15}/></button></Tip>}
      {advanced&&<><button className={wire?'active':''} aria-label="查看网格" onClick={()=>setWire(!wire)}><ScanLine size={16}/></button><button className={bones?'active':''} aria-label="查看骨架" onClick={()=>setBones(!bones)}><Bone size={16}/></button></>}
    </div></div>}
    <div ref={host} className="canvas-host"/>
    {!ready&&<div className="stage-message">{!error&&<LoaderCircle size={20} className="spin"/>}{error||'正在载入你的模型…'}</div>}
    {!hidePlayback&&duration>0&&<div className="playbar">
      <button className="play-toggle" aria-label={paused?'播放':'暂停'} onClick={()=>setPaused(!paused)}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>
      <button className="restart-button" aria-label="回到动作起点" onClick={()=>{const a=world.current?.action();if(a){a.time=0;world.current.mixer.update(0);setTime(0);}}}><RotateCcw size={14}/></button>
      {preview||!showClipSelector?<span className="viewer-preview-name">{preview?.displayName||motionName(preview?.name||rawMotionName(clips.find(c=>c.index===clipIndex)||{},asset))}</span>:<SelectField label="预览动作" value={clipIndex} onChange={value=>onClip?.(+value)} options={clips.map(c=>({value:c.index,label:motionName(rawMotionName(c,asset))}))}/>}
      <input aria-label="动画进度" type="range" min="0" max={duration} step="0.01" value={Math.min(time,duration)} onChange={e=>{const a=world.current?.action();if(a){a.time=+e.target.value;world.current.mixer.update(0);setTime(a.time);}}}/>
      <span className="time-label">{time.toFixed(1)} / {duration.toFixed(1)}s</span>
    </div>}
  </div>;
}

