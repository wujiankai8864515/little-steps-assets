import {readCatalog,fileLink} from '../web/github.js';
const [command='list',id]=process.argv.slice(2);
try{
  const {catalog,unavailable}=await readCatalog();
  if(unavailable)throw Error('云端资源分支尚未初始化');
  if(command==='list')console.log(JSON.stringify({updatedAt:catalog.updatedAt,assets:catalog.assets.map(a=>({id:a.id,name:a.name,kind:a.kind,status:a.status,primaryUrl:fileLink(a.files.find(f=>f.path===a.primaryPath))})),workspaces:catalog.workspaces},null,2));
  else if(command==='inspect'||command==='url'){
    const asset=catalog.assets.find(a=>a.id===id);if(!asset)throw Error('未找到这个素材标识');
    if(command==='inspect')console.log(JSON.stringify({...asset,files:asset.files.map(f=>({...f,url:fileLink(f)}))},null,2));
    else console.log(fileLink(asset.files.find(f=>f.path===asset.primaryPath)));
  }else throw Error('用法：node scripts/cloud.mjs list | inspect ASSET_ID | url ASSET_ID');
}catch(e){console.error(e.message);process.exitCode=1;}
