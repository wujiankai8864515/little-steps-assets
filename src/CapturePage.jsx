import React,{useEffect,useRef,useState} from 'react';
import Viewer from './Viewer.jsx';
import {TooltipProvider} from './components/ui.jsx';

// Machine entry point for a persisted local frames job; it uses the exact same viewer/capture code.
export default function CapturePage(){
 const [request,setRequest]=useState(null),[controls,setControls]=useState(null),started=useRef(false);
 useEffect(()=>{const params=new URLSearchParams(location.search);fetch('/api/frame-capture/'+encodeURIComponent(params.get('captureJob'))+'?clip='+encodeURIComponent(params.get('clip'))).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);setRequest(data);}).catch(e=>{window.captureResult={error:e.message};});},[]);
 useEffect(()=>{
  if(!controls||!request||started.current)return;started.current=true;const controller=new AbortController();
  (async()=>{
   try{
    const frames=await controls.capture({...request.spec,signal:controller.signal,onProgress:(done,total)=>window.reportCaptureProgress?.({done,total})});
    const form=new FormData();form.append('request',JSON.stringify({...request.spec,parentJobId:request.jobId}));frames.forEach((blob,i)=>form.append('frames',blob,String(i).padStart(4,'0')+'.png'));
    const r=await fetch('/api/render-view',{method:'POST',body:form,signal:controller.signal}),job=await r.json();if(!r.ok)throw Error(job.error);window.captureResult={jobId:job.id};
   }catch(e){window.captureResult={error:e.message};}
  })();
  return()=>controller.abort();
 },[controls,request]);
 return <TooltipProvider><div style={{width:640,height:640}}>{request&&<Viewer asset={request.asset} frameMode initialView={request.spec.view} clipIndex={request.spec.clipIndex} hidePlayback onControlsReady={setControls} onReady={(ok,error)=>{if(error)window.captureResult={error};}}/>}</div></TooltipProvider>;
}
