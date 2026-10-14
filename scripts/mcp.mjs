import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {pathToFileURL} from 'node:url';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';import {z} from 'zod';import {execute} from './client.mjs';import {commandNames} from './command-definitions.mjs';
const installed=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'skills/asset-workbench/scripts/运行管理.mjs');
const {readBinding,ensureService,localCommands,manage}=await import(fs.existsSync(installed)?pathToFileURL(installed).href:new URL('../skill/scripts/运行管理.mjs',import.meta.url).href);
const server=new McpServer({name:'asset-workbench',version:'0.2.0'});
server.tool('asset_workbench','使用与中文网页共用的本机资产库。help 返回中文能力路由；search/inspect 查询精确引用；plan 跟踪玩法需求；preview/compose 使用同一动作引用；frames 导出后自动入库；review-frames 提供洋葱皮证据，由调用者看图后 review-result 保存判断；handoff 提供交付清单。open/pack/restore 管理绑定的服务和迁移。收费 submit 必须有本次具体授权，未知结果先 quote-status。',{command:z.enum([...new Set([...commandNames,...localCommands])]),arguments:z.record(z.unknown()).default({})},async({command,arguments:args})=>{
 try{let result;if(localCommands.includes(command))result=await manage(command,args);else{const c=readBinding();await ensureService(c);process.env.ASSET_WORKBENCH_URL=c.baseUrl;result=await execute(command,args);}return {content:[{type:'text',text:JSON.stringify(result)}]};}
 catch(e){return {content:[{type:'text',text:JSON.stringify({error:e.message,code:e.code,nextAction:e.nextAction})}],isError:true};}
});
await server.connect(new StdioServerTransport());
