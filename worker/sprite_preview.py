"""Build a library GIF from existing PNG frames. Source archives stay untouched."""
import io,json,sys,zipfile
from PIL import Image

source,manifest_path,output=sys.argv[1:4]
meta=json.load(open(manifest_path,encoding='utf-8-sig'))
images=[];durations=[];fps=float(meta['fps'])
with zipfile.ZipFile(source) as archive:
    for clip in meta['clips']:
        for i,frame in enumerate(clip['frames']):
            info=archive.getinfo(frame['file'])
            if info.file_size>16*1024*1024:raise ValueError('单帧文件过大')
            with Image.open(io.BytesIO(archive.read(info))) as original:
                rgba=original.convert('RGBA')
                if rgba.size!=(meta['size'],meta['size']):raise ValueError('序列帧尺寸不一致')
                image=rgba.convert('RGB').quantize(colors=255,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE)
                palette=image.getpalette()[:765];palette.extend([0]*(768-len(palette)));image.putpalette(palette)
                image.paste(255,mask=rgba.getchannel('A').point(lambda a:255 if a<128 else 0))
                image.info['transparency']=255;images.append(image)
            start=frame.get('time',i/fps)
            end=clip['frames'][i+1].get('time',(i+1)/fps) if i+1<len(clip['frames']) else clip.get('duration',(i+1)/fps)
            durations.append(max(10,(round(end*100)-round(start*100))*10))
            if len(images)>3000:raise ValueError('预览最多 3000 帧')
if not images:raise ValueError('没有可播放的原帧')
images[0].save(output,save_all=True,append_images=images[1:],duration=durations,loop=0,transparency=255,background=255,disposal=2,optimize=False)
print('WB:'+json.dumps({'stage':'序列帧预览已准备好','done':len(images),'total':len(images)},ensure_ascii=False),flush=True)
