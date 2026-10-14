import sys,json,os,zipfile,math,html
from PIL import Image
folder=sys.argv[1];p=os.path.join(folder,'frames.json');meta=json.load(open(p,encoding='utf-8'));size=meta['size'];cell=size+4;columns=max(1,2048//cell);capacity=columns**2
for ci,clip in enumerate(meta['clips']):
 clip['atlases']=[]
 for start in range(0,len(clip['frames']),capacity):
  chunk=clip['frames'][start:start+capacity];rows=math.ceil(len(chunk)/columns);atlas=Image.new('RGBA',(columns*cell,rows*cell))
  filename=f'atlas_{ci:02d}_{start//capacity:02d}.png'
  for i,frame in enumerate(chunk):
   x=(i%columns)*cell+2;y=(i//columns)*cell+2;atlas.paste(Image.open(os.path.join(folder,frame['file'])).convert('RGBA'),(x,y));frame.update(atlas=filename,rect=[x,y,size,size],pivot=meta.get('pivot',[.5,.5]))
  atlas.save(os.path.join(folder,filename));clip['atlases'].append(filename)
json.dump(meta,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
Image.open(os.path.join(folder,meta['clips'][0]['frames'][0]['file'])).save(os.path.join(folder,'preview.png'))
data=json.dumps(meta,ensure_ascii=False).replace('</','<\/')
preview='''<!doctype html><meta charset="utf-8"><title>序列帧预览</title><style>body{background:#eee;font:16px system-ui;text-align:center}img{background:repeating-conic-gradient(#ddd 0% 25%,#eee 0% 50%) 0/24px 24px;max-width:85vw}</style><h2>序列帧预览</h2><select id="clips"></select><button id="play">暂停</button><p id="info"></p><img id="frame"><script>const data=DATA;let a=0,i=0,play=true;data.clips.forEach((c,k)=>clips.add(new Option(c.name,k)));clips.onchange=()=>{a=+clips.value;i=0};document.getElementById('play').onclick=()=>{play=!play};setInterval(()=>{const c=data.clips[a];frame.src=c.frames[i].file;info.textContent=(i+1)+' / '+c.frames.length;if(play)i=(i+1)%c.frames.length},1000/data.fps)</script>'''.replace('DATA',data)
open(os.path.join(folder,'preview.html'),'w',encoding='utf-8').write(preview)
with zipfile.ZipFile(os.path.join(folder,'sprites.zip'),'w',zipfile.ZIP_DEFLATED) as z:
 for root,dirs,files in os.walk(folder):
  for file in files:
   if file.endswith(('.png','.gif','.html','.json')) and file!='result.json':
    f=os.path.join(root,file);z.write(f,os.path.relpath(f,folder))
print(json.dumps(dict(file='sprites.zip')))
