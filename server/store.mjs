import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';import {fileURLToPath} from 'node:url';import crypto from 'node:crypto';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');export const DATA=path.resolve(process.env.WORKBENCH_DATA_DIR||path.join(ROOT,'data'));fs.mkdirSync(DATA,{recursive:true});
const db=new DatabaseSync(path.join(DATA,'workbench.sqlite'));db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, body TEXT NOT NULL, PRIMARY KEY(kind,id));');
export const uid=()=>crypto.randomUUID();export const now=()=>new Date().toISOString();
export const list=k=>db.prepare('SELECT body FROM records WHERE kind=? ORDER BY rowid DESC').all(k).map(x=>JSON.parse(x.body));
export function get(k,id){let row=db.prepare('SELECT body FROM records WHERE kind=? AND id=?').get(k,id);return row?JSON.parse(row.body):null;}
export function put(k,v){db.prepare('INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body').run(k,v.id,JSON.stringify(v));return v;}
export function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
export function closeStore(){db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close();}
export const library=get('settings','library')||put('settings',{id:'library',libraryId:uid(),schemaVersion:1,createdAt:now()});
export function safe(base,rel){const dest=path.resolve(base,rel);if(dest!==path.resolve(base)&&!dest.startsWith(path.resolve(base)+path.sep))throw Error('文件路径超出资产包');return dest;}
export const rel=p=>path.relative(DATA,p).replaceAll('\\','/');export const full=p=>safe(DATA,p);
export function saveJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2));}
