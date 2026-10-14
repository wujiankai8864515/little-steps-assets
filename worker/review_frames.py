"""按原 PNG 生成可追踪的洋葱皮与锚点证据；不修图、不自动判定质量。"""
import sys,json,os,zipfile,io,math,datetime,hashlib
from PIL import Image,ImageDraw,ImageFont,ImageChops,ImageStat
q=json.load(open(sys.argv[1],encoding='utf-8'));out=q['output'];os.makedirs(out,exist_ok=True);os.makedirs(os.path.join(out,'frames'),exist_ok=True)
fontpath='C:/Windows/Fonts/msyh.ttc'
font=ImageFont.truetype(fontpath,15) if os.path.exists(fontpath) else ImageFont.load_default()
small=ImageFont.truetype(fontpath,12) if os.path.exists(fontpath) else font
evidence=[];actions=[];images=[];masks=[]
def save(im,name,eid,title):
 im.save(os.path.join(out,name));evidence.append(dict(id=eid,file=name,title=title,sha256=hashlib.sha256(open(os.path.join(out,name),'rb').read()).hexdigest()));return name
def background(size):
 im=Image.new('RGBA',size,(246,248,246,255));d=ImageDraw.Draw(im)
 for y in range(0,size[1],24):
  for x in range(0,size[0],24):
   if (x//24+y//24)%2:d.rectangle((x,y,x+23,y+23),fill=(231,237,233,255))
 return im
def tinted(im,color,opacity=.3):
 result=Image.new('RGBA',im.size,color+(0,));result.putalpha(im.getchannel('A').point(lambda a:round(a*opacity)));return result
def cross(im,pivot,color=(45,69,54,255)):
 if pivot:
  x=round(pivot[0]*im.width);y=round(pivot[1]*im.height);d=ImageDraw.Draw(im);d.line((x-10,y,x+10,y),fill=color,width=2);d.line((x,y-10,x,y+10),fill=color,width=2)
def span(values): return max(values)-min(values) if values else None
def validpivot(p):return isinstance(p,list) and len(p)==2 and all(isinstance(v,(int,float)) and math.isfinite(v) for v in p)
for ai,sel in enumerate(q['selections']):
 m=sel['manifest'];clip=sel['clip'];frames=[];thumbs=[];binary=[]
 with zipfile.ZipFile(sel['file']) as z:
  names=set(z.namelist())
  for fi,f in enumerate(clip['frames']):
   name=f['file']
   if name not in names or not name.lower().endswith('.png') or z.getinfo(name).file_size>20*1024*1024:raise ValueError('原 PNG 缺失或大小不支持：'+name)
   im=Image.open(io.BytesIO(z.read(name))).convert('RGBA');w,h=im.size
   if w>2048 or h>2048:raise ValueError('单帧尺寸超过 2048')
   alpha=im.getchannel('A').point(lambda a:255 if a>24 else 0);box=alpha.getbbox();pivot=f.get('pivot',m.get('pivot'));pivot=pivot if validpivot(pivot) else None
   # Bounding-box center is deliberately not labelled as anatomical center of mass.
   center=[(box[0]+box[2])/2,(box[1]+box[3])/2] if box else None
   lowest=box[3]-1 if box else None;edge=bool(box and (box[0]<=1 or box[1]<=1 or box[2]>=w-1 or box[3]>=h-1))
   thumb=im.resize((384,384),Image.Resampling.LANCZOS);thumbfile=f'frames/{ai:02d}_{fi:04d}.png';thumb.save(os.path.join(out,thumbfile));thumbs.append(os.path.join(out,thumbfile))
   frames.append(dict(index=fi,time=f.get('time'),sourceFile=name,file=thumbfile,width=w,height=h,pivot=pivot,box=box,boxCenter=center,silhouetteBottom=lowest,touchesEdge=edge))
 if len({(f['width'],f['height']) for f in frames})!=1:raise ValueError('一个片段里的画布尺寸不一致')
 width,height=frames[0]['width'],frames[0]['height'];ps=[f['pivot'] for f in frames if f['pivot']];centers=[f['boxCenter'] for f in frames if f['boxCenter']]
 metrics={'pivotKnown':len(ps)==len(frames),'pivotRangePixels':[span([p[0]*width for p in ps]),span([p[1]*height for p in ps])], 'boxCenterRangePixels':[span([c[0] for c in centers]),span([c[1] for c in centers])], 'silhouetteBottomRangePixels':span([f['silhouetteBottom'] for f in frames if f['silhouetteBottom'] is not None]),'edgeFrames':[f['index'] for f in frames if f['touchesEdge']],'emptyFrames':[f['index'] for f in frames if not f['box']]}
 samples=sorted(set(round(i*(len(frames)-1)/5) for i in range(6)));sheet=background((768,556));d=ImageDraw.Draw(sheet);d.text((14,7),sel['label']+' · 原帧采样',font=font,fill=(35,57,42))
 for k,fi in enumerate(samples):
  x=(k%3)*256;y=32+(k//3)*262;tile=Image.open(thumbs[fi]).convert('RGBA').resize((256,256));sheet.alpha_composite(tile,(x,y));t=frames[fi]['time'];stamp=f'{t:.3f}s' if isinstance(t,(int,float)) else '未知时间';d.text((x+8,y+5),f'帧 {fi} / {stamp}',font=small,fill=(38,58,45))
 save(sheet,f'action_{ai:02d}_samples.png',f'action-{ai}-samples',sel['label']+'：原帧样本')
 onion=background((512,550));layer=background((512,512))
 for k,fi in enumerate(samples):layer.alpha_composite(tinted(Image.open(thumbs[fi]).convert('RGBA').resize((512,512)),(24,164,192) if k<len(samples)/2 else (235,130,60),.24))
 cross(layer,ps[0] if ps else None);onion.alpha_composite(layer,(0,38));ImageDraw.Draw(onion).text((12,9),sel['label']+' · 固定画布叠加',font=font,fill=(35,57,42))
 save(onion,f'action_{ai:02d}_onion.png',f'action-{ai}-onion',sel['label']+'：动作内锚点与轮廓')
 actions.append(dict(assetId=sel['assetId'],sha256=sel['sha256'],clipIndex=sel['clipIndex'],label=sel['label'],loop=sel['loop'],sourceAssetId=m.get('sourceAssetId'),sourceHash=m.get('sourceHash'),camera=m.get('camera'),renderer=m.get('renderer'),size=[width,height],pivot=m.get('pivot'),fps=m.get('fps'),rootMotion=m.get('rootMotion','unknown'),metrics=metrics,frames=frames));images.append(thumbs);masks.append(binary)
 print('WB:'+json.dumps(dict(stage='正在校对 '+sel['label'],done=ai+1,total=len(q['selections'])),ensure_ascii=False),flush=True)
def compatible(a,b):
 reasons=[]
 for key,label in [('sourceHash','源模型版本'),('camera','相机'),('renderer','渲染器')]:
  if not a.get(key) or not b.get(key):reasons.append(label+'记录缺失')
  elif a[key]!=b[key]:reasons.append(label+'不同')
 if a['size']!=b['size']:reasons.append('画布尺寸不同')
 if not a['metrics']['pivotKnown'] or not b['metrics']['pivotKnown']:reasons.append('锚点记录缺失')
 return reasons
pairs=q['pairs']
transitions=[]
for pi,pair in enumerate(pairs):
 ia,ib=pair['fromAction'],pair['toAction'];kind=pair.get('kind','transition')
 a,b=actions[ia],actions[ib];reasons=compatible(a,b);fa,fb=pair['fromFrame'],pair['toFrame'];layer=background((512,512))
 layer.alpha_composite(tinted(Image.open(images[ia][fa]).convert('RGBA').resize((512,512)),(20,155,190),.55));layer.alpha_composite(tinted(Image.open(images[ib][fb]).convert('RGBA').resize((512,512)),(235,125,60),.55));cross(layer,a['frames'][fa]['pivot'],(15,136,164,255));cross(layer,b['frames'][fb]['pivot'],(189,81,24,255))
 result=background((768,590));result.alpha_composite(layer,(128,46));d=ImageDraw.Draw(result);d.text((14,10),a['label']+' → '+b['label']+('（循环）' if kind=='loop' else ''),font=font,fill=(35,57,42));d.text((14,566),f'青色：前动作第 {fa} 帧  橙色：后动作第 {fb} 帧  十字：声明锚点',font=font,fill=(35,57,42))
 filename=save(result,f'transition_{pi:02d}.png',f'transition-{pi}',a['label']+' → '+b['label'])
 ma=Image.open(images[ia][fa]).getchannel('A').point(lambda a:255 if a>24 else 0).resize((256,256),Image.Resampling.NEAREST);mb=Image.open(images[ib][fb]).getchannel('A').point(lambda a:255 if a>24 else 0).resize((256,256),Image.Resampling.NEAREST);inter=ImageChops.multiply(ma,mb);union=ImageChops.lighter(ma,mb);denom=ImageStat.Stat(union).sum[0];overlap=ImageStat.Stat(inter).sum[0]/denom if denom else None
 pa=a['frames'][fa]['pivot'];pb=b['frames'][fb]['pivot'];gap=math.hypot((pa[0]-pb[0])*a['size'][0],(pa[1]-pb[1])*a['size'][1]) if pa and pb and not reasons else None
 transitions.append(dict(id=f'transition-{pi}',fromAction=ia,toAction=ib,fromFrame=fa,toFrame=fb,kind=kind,comparable=not reasons,reasons=reasons,pivotGapPixels=gap,silhouetteIoU=overlap if not reasons else None,image=filename))
report={'schemaVersion':2,'name':q['name'],'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'intent':q['intent'],'rootMotionPolicy':q['rootMotionPolicy'],'previousReviewId':q.get('previousReviewId'),'actions':actions,'transitions':transitions,'evidence':evidence,'aiStatus':'pending','limitations':['轮廓中心和最低点不是骨骼根节点或足部接触，主动位移不能自动判错。','叠加预览按画布等比例显示；原序列图没有裁剪、重居中或改动。','没有相机或源模型记录时，只能目视参考，不能可靠比较跨动作稳定性。','量测完成不代表动作已连贯；需要调用者 Codex 看图并保存判断。']}
json.dump(report,open(os.path.join(out,'report.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=2)
