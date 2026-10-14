"""资产工坊迁移包：只复制、逐文件校验、不删除原库。"""
import sys, os, json, zipfile, hashlib, sqlite3, tempfile, pathlib, shutil, stat, datetime
P = pathlib.Path
def load(p):
    return json.loads(P(p).read_text(encoding='utf-8-sig'))
def digest(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''): h.update(block)
    return h.hexdigest()
def library(p):
    db=sqlite3.connect(P(p).as_uri()+'?mode=ro',uri=True)
    try: return json.loads(db.execute("select body from records where kind='settings' and id='library'").fetchone()[0])['libraryId']
    finally: db.close()
def pack(q):
    runtime=P(q['projectRoot']).resolve();data=P(q['dataRoot']).resolve();skill=P(q['skillRoot']).resolve();output=P(q['output']).resolve()
    if any(output.is_relative_to(p) for p in (runtime,data,skill)): raise ValueError('迁移包请放在程序、数据和 Skill 目录之外，避免把包再次装入包中')
    if output.exists() or P(str(output)+'.partial').exists(): raise ValueError('目标包或未完成包已存在，请换一个文件名')
    if library(data/'workbench.sqlite')!=q['libraryId']: raise ValueError('库身份不一致')
    output.parent.mkdir(parents=True,exist_ok=True);partial=P(str(output)+'.partial');entries=[]
    note='''# 资产工坊恢复说明

本包包含程序、全局 Skill 和完整资产数据。原库不需要删除。
1. 在有 Node 26、Python 3.11 的电脑上，先解压 skill 文件夹到一个临时目录，保留脚本和参考文件。
2. 用 Python 运行该目录中的 scripts/迁移资产库.py，并传入 UTF-8 JSON 请求文件。字段：mode 为 restore、archive 为本 ZIP 绝对路径、projectRoot 为新的空程序目录、dataRoot 为新的空数据目录。
3. 恢复脚本核对清单、SHA256 和库 ID；有失败不要切换绑定。运行环境依赖没有包含在包内。
4. 在新程序目录执行 npm ci --no-audit --no-fund。dist 已包含，修改源码后再 npm run build。
5. 新程序的 skill/references/workbench.json 已写入新地址。运行 scripts/install-skill.ps1 -BaseUrl http://127.0.0.1:4380 -DataRoot 新数据目录 -Offline，安装到默认 C 盘全局 Skill（自定义 CODEX_HOME 时遵循该设置）。
6. 用全局入口 doctor 查看依赖，再 open 启动页面。相同电脑迁移前先 stop 旧服务，旧库有任务时先等待完成。
7. Blender、Pillow、Chrome/Playwright、Lux3D 插件与账户 Key 按 Skill 中运行与迁移.md 配置。不要用原机器绝对路径冒充已安装依赖。

包内数据库含任务、需求、来源、审核和资产映射；过期报价已清除，不可继续旧报价提交。收费远端任务只能通过原任务 ID 续查。
恢复不会把资产合并到另一个现有库，也不会自动删除旧地址。确认使用新库后是否清理旧文件由用户决定。
'''
    with tempfile.TemporaryDirectory(prefix='asset-workbench-') as tmp:
        snapshot=P(tmp)/'workbench.sqlite';src=sqlite3.connect(data/'workbench.sqlite');dst=sqlite3.connect(snapshot)
        try:
            src.backup(dst);dst.execute("delete from records where kind='quotes'");dst.commit();dst.execute('pragma wal_checkpoint(TRUNCATE)')
        finally: dst.close();src.close()
        files=[]
        root_files=['package.json','package-lock.json','index.html','vite.config.mjs','README.md','AGENTS.md','start.ps1','启动资产工坊.cmd']
        files += [(runtime/name,'runtime/'+name) for name in root_files if (runtime/name).is_file()]
        for directory in ['server','shared','scripts','src','worker','docs','dist']:
            for p in (runtime/directory).rglob('*'):
                if p.is_file() and not p.is_symlink() and '__pycache__' not in p.parts and p.suffix not in ['.pyc','.log']: files.append((p,'runtime/'+p.relative_to(runtime).as_posix()))
        for p in skill.rglob('*'):
            if p.is_file() and not p.is_symlink() and '__pycache__' not in p.parts and p.suffix!='.pyc': files.append((p,'skill/'+p.relative_to(skill).as_posix()))
        excluded={'workbench.sqlite','workbench.sqlite-wal','workbench.sqlite-shm','service.json','service-management.lock'}
        for p in data.rglob('*'):
            if p.is_file() and not p.is_symlink() and p.name not in excluded and p.suffix not in ['.log','.pyc'] and '__pycache__' not in p.parts: files.append((p,'data/'+p.relative_to(data).as_posix()))
        files.append((snapshot,'data/workbench.sqlite'))
        with zipfile.ZipFile(partial,'x',zipfile.ZIP_DEFLATED,compresslevel=1,allowZip64=True) as z:
            for source,name in files:
                expected=runtime if name.startswith('runtime/') else skill if name.startswith('skill/') else data
                if source!=snapshot and not source.resolve().is_relative_to(expected): raise ValueError('源文件通过链接超出绑定目录：'+name)
                h=hashlib.sha256();size=0
                with open(source,'rb') as f,z.open(name,'w',force_zip64=True) as target:
                    for block in iter(lambda:f.read(1024*1024),b''): h.update(block);size+=len(block);target.write(block)
                entries.append({'path':name,'bytes':size,'sha256':h.hexdigest()})
            z.writestr('恢复说明.md',note)
            manifest={'format':'asset-workbench-bundle','version':1,'libraryId':q['libraryId'],'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':entries,'excluded':['私有账户凭据','node_modules','外部软件','过期报价','进程锁','日志'],'dependencies':['Node 26','Python 3.11 + Pillow','Blender','Chrome + Playwright','按需 Lux3D 官方运行时']}
            z.writestr('迁移清单.json',json.dumps(manifest,ensure_ascii=False,indent=2))
        partial.rename(output)
    return {'archive':str(output),'bytes':output.stat().st_size,'sha256':digest(output),'libraryId':q['libraryId'],'files':len(entries),'next':'目标位置确定后执行 restore，再安装依赖与绑定'}
def restore(q):
    runtime=P(q['projectRoot']).resolve();data=P(q['dataRoot']).resolve()
    # Independent empty roots keep recovery failures from touching an existing installation.
    if runtime==data or runtime.is_relative_to(data): raise ValueError('程序与数据不能是相同目录，程序也不能放在数据目录里')
    for root in (runtime,data):
        if root.exists() and any(root.iterdir()): raise ValueError('恢复目标必须为空目录：'+str(root))
    with zipfile.ZipFile(q['archive']) as z:
        manifest=json.loads(z.read('迁移清单.json'));entries=manifest['files']
        if manifest.get('format')!='asset-workbench-bundle' or manifest.get('version')!=1: raise ValueError('不支持的迁移包版本')
        names=[e['path'] for e in entries]
        if len(set(n.casefold() for n in names))!=len(names): raise ValueError('包内路径重复')
        zipnames=[i.filename for i in z.infolist()]
        if len(set(n.casefold() for n in zipnames))!=len(zipnames): raise ValueError('ZIP 条目重复')
        if set(zipnames)!=set(names)|{'迁移清单.json','恢复说明.md'}: raise ValueError('ZIP 与清单不一致')
        if sum(e['bytes'] for e in entries)>200*1024**3: raise ValueError('迁移包解压超过 200GB，请单独规划迁移')
        targets=[]
        for entry in entries:
            name=entry['path'];parts=name.split('/');info=z.getinfo(name)
            if '\\' in name or ':' in name or any(s in ('','.','..') for s in parts) or stat.S_ISLNK(info.external_attr>>16): raise ValueError('ZIP 路径不安全')
            prefix=parts.pop(0);root={'runtime':runtime,'skill':runtime/'skill','data':data}.get(prefix)
            if root is None or info.file_size!=entry['bytes']: raise ValueError('ZIP 条目或大小不一致')
            dest=root.joinpath(*parts).resolve()
            if not dest.is_relative_to(root.resolve()): raise ValueError('条目超出目标目录')
            targets.append((entry,dest))
        destinations=[str(p).casefold() for _,p in targets]
        if len(destinations)!=len(set(destinations)): raise ValueError('程序、Skill 和数据的恢复路径冲突')
        for entry,dest in targets:
            dest.parent.mkdir(parents=True,exist_ok=True)
            with z.open(entry['path']) as source,open(dest,'xb') as output: shutil.copyfileobj(source,output,1024*1024)
            if digest(dest)!=entry['sha256']: raise ValueError('文件哈希不一致，保留未完成目录以便诊断：'+entry['path'])
        if library(data/'workbench.sqlite')!=manifest['libraryId']: raise ValueError('恢复后的库 ID 不符')
        binding={'projectRoot':str(runtime),'dataRoot':str(data),'baseUrl':'http://127.0.0.1:4380','protocolVersion':2,'libraryId':manifest['libraryId']}
        (runtime/'skill/references/workbench.json').write_text(json.dumps(binding,ensure_ascii=False,indent=2),encoding='utf-8')
        (runtime/'迁移清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        (runtime/'恢复说明.md').write_bytes(z.read('恢复说明.md'))
    return {'restored':True,'projectRoot':str(runtime),'dataRoot':str(data),'libraryId':manifest['libraryId'],'files':len(entries),'globalBindingChanged':False}
try:
    q=load(sys.argv[1]);result=pack(q) if q['mode']=='pack' else restore(q) if q['mode']=='restore' else (_ for _ in ()).throw(ValueError('未知迁移操作'))
    print(json.dumps(result,ensure_ascii=False))
except Exception as e:
    print(str(e),file=sys.stderr);sys.exit(1)
