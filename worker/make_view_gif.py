"""Encode the exact PNG frames captured by the web viewer. No rerendering."""
import json,os,sys,traceback
from PIL import Image

try:
 folder=sys.argv[1]
 meta=json.load(open(os.path.join(folder,'frames.json'),encoding='utf-8'))
 frames=meta['clips'][0]['frames'];images=[];fps=meta['fps']
 for i,frame in enumerate(frames):
  with Image.open(os.path.join(folder,frame['file'])) as original:
   rgba=original.convert('RGBA')
   if rgba.size!=(meta['size'],meta['size']):raise ValueError('序列图片大小不一致')
   # Reserve one palette entry for transparency; preserve the full RGBA PNGs separately.
   image=rgba.convert('RGB').quantize(colors=255,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE)
   palette=image.getpalette()[:765];palette.extend([0]*(768-len(palette)));image.putpalette(palette)
   image.paste(255,mask=rgba.getchannel('A').point(lambda a:255 if a<128 else 0))
   image.info['transparency']=255;images.append(image)
  if i%8==0 or i==len(frames)-1:print('WB:'+json.dumps(dict(stage='正在生成 GIF',done=i+1,total=len(frames)),ensure_ascii=False),flush=True)
 # GIF delays use centiseconds. Distribute rounding so playback keeps the source duration.
 duration=meta['clips'][0]['duration'];ticks=[max(1,round(min((i+1)/fps,duration)*100)-round(i*100/fps)) for i in range(len(images))]
 excess=sum(ticks)-max(len(images),round(duration*100))
 for i in range(len(ticks)-1,-1,-1):
  if excess<=0:break
  take=min(ticks[i]-1,excess);ticks[i]-=take;excess-=take
 if excess<0:ticks[-1]-=excess
 durations=[t*10 for t in ticks]
 images[0].save(os.path.join(folder,'preview.gif'),save_all=True,append_images=images[1:],duration=durations,loop=0,transparency=255,background=255,disposal=2,optimize=False)
 print('WB:'+json.dumps(dict(stage='GIF 已生成',done=len(frames),total=len(frames)),ensure_ascii=False),flush=True)
except Exception as e:
 print('WB_ERROR:'+str(e),flush=True);traceback.print_exc();sys.exit(1)
