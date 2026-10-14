import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {readBinding,ensureService,localCommands,manage} from './运行管理.mjs';
try{
 const command=process.argv[2]||'help',body=process.argv[3]?JSON.parse(fs.readFileSync(process.argv[3],'utf8').replace(/^\uFEFF/,'')):{};
 if(localCommands.includes(command)){console.log(JSON.stringify(await manage(command,body),null,2));}
 else{
  const config=readBinding();await ensureService(config);process.env.ASSET_WORKBENCH_URL=config.baseUrl;
  const {execute}=await import(pathToFileURL(path.join(config.projectRoot,'scripts/client.mjs')).href);
  console.log(JSON.stringify(await execute(command,body),null,2));
 }
}catch(e){console.error(JSON.stringify({error:e.message,code:e.code||'LOCAL_COMMAND_FAILED',nextAction:e.nextAction||{instruction:'按错误原因查看能力索引对应文档；只有服务连接、路径和依赖问题使用 doctor。'}}));process.exitCode=1;}
