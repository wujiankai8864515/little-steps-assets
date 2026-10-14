import fs from 'node:fs';import path from 'node:path';import {DATA,list,put,full,uid,now} from '../server/store.mjs';import {readGlb,writeGlb} from '../server/glb.mjs';import {register} from '../server/jobs.mjs';
for(const a of list('assets')){
 if(a.kind!=='model'||!a.name.startsWith('战术主角')||a.supersededBy)continue;
 const g=readGlb(full(a.file));const fixes=[];
 for(const m of g.json.materials||[])if(m.name==='Designer_Logic_PBR'&&m.alphaMode==='BLEND'){m.alphaMode='OPAQUE';delete m.alphaCutoff;fixes.push(m.name);}
 if(!fixes.length)continue;
 const dir=path.join(DATA,'work','material-repair-'+uid());fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'character.glb');writeGlb(file,g.json,g.bin);
 const fixed=register(file,{name:a.name,parents:[a.id],source:a.source,license:a.license,processing:{...a.processing,materialFix:'身体材质改为不透明；网格、动画和贴图二进制保持原样'},supersedes:a.id});
 put('assets',{...a,supersededBy:fixed.id});put('jobs',{id:uid(),type:'repair',params:{modelId:a.id},state:'succeeded',stage:'已修正身体透明显示，原文件保留',outputs:[fixed.id],createdAt:now(),updatedAt:now(),events:[]});console.log(JSON.stringify({name:fixed.name,id:fixed.id,previous:a.id}));
}
