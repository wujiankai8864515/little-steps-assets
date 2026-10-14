import fs from 'node:fs';import {commandNames} from './command-definitions.mjs';import {execute} from './client.mjs';
const command=process.argv[2];if(!command||command==='help'){console.log('node scripts/cli.mjs <'+commandNames.join('|')+'> [request.json]');process.exit(0);}
try{const body=process.argv[3]?JSON.parse(fs.readFileSync(process.argv[3],'utf8').replace(/^\uFEFF/,'')):{};console.log(JSON.stringify(await execute(command,body),null,2));}catch(e){console.error(e.message);process.exit(1);}
