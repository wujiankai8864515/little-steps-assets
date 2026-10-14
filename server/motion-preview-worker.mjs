import {parentPort,workerData as p} from 'node:worker_threads';
import fs from 'node:fs';import path from 'node:path';
import {composeExact,inspect} from './glb.mjs';
import {retargetHumanoid} from './retarget.mjs';
import {exportAnimationClip} from './animation-clip.mjs';
const stage=s=>parentPort.postMessage({stage:s});
try {
  fs.mkdirSync(p.dir,{recursive:true});
  const intermediate=path.join(p.dir,'working.glb'),output=path.join(p.dir,'motion.glb');
  stage('正在读取原始动作');
  let adaptation=null;
  if(p.sourceRig===p.targetRig){stage('正在准备目标模型试播');composeExact(p.target,[{file:p.source,index:p.index,name:p.name}],intermediate);}
  else {stage('正在将动作适配到你的模型');adaptation=retargetHumanoid(p.target,p.source,p.index,p.name,intermediate);}
  stage('正在准备播放');exportAnimationClip(intermediate,0,output);fs.unlinkSync(intermediate);
  const metadata=inspect(output);
  parentPort.postMessage({done:true,file:output,duration:metadata.animations[0].duration,bytes:metadata.bytes,adaptation});
} catch(e){parentPort.postMessage({error:e.message,needsInput:e.name==='NeedsInput'||e.constructor.name==='NeedsInput'});}
