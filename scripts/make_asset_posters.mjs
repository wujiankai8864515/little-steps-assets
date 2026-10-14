import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {DATA,list,get,put,full,rel,ROOT,now} from '../server/store.mjs';
const dir=path.join(DATA,'work','asset-posters');fs.mkdirSync(dir,{recursive:true});
const assets=list('assets').filter(a=>a.kind==='model'&&!a.supersededBy&&(!a.thumbnail||process.argv.includes('--refresh'))&&a.quality!=='有问题');
const cfg=assets.map(a=>({id:a.id,input:full(a.file),output:full(path.join('assets',a.id,'poster.png'))}));
const config=path.join(dir,'input.json');fs.writeFileSync(config,JSON.stringify(cfg));
if(cfg.length){
 const child=spawn('C:/Program Files/Blender Foundation/Blender 5.1/blender.exe',['--background','--factory-startup','--python',path.join(ROOT,'worker','asset_posters.py'),'--',config],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 const log=fs.createWriteStream(path.join(dir,'process.log'));child.stdout.pipe(log);child.stderr.pipe(log);
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
 for(const entry of cfg)if(fs.existsSync(entry.output)){
   const current=get('assets',entry.id);put('assets',{...current,thumbnail:rel(entry.output),thumbnailUpdatedAt:now()});
 }
 console.log(JSON.stringify({exitCode:code,created:cfg.filter(c=>fs.existsSync(c.output)).length,requested:cfg.length}));
 if(code)process.exitCode=code;
}else console.log('模型缩略图已齐备');
