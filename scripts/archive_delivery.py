import json,hashlib,shutil,datetime,urllib.request
from pathlib import Path
root=Path('D:/godotGames/AssetWorkbench');data=root/'data'
state=json.load(urllib.request.urlopen('http://127.0.0.1:4380/api/state'))
model=next(a for a in state['assets'] if a['name']=='战术主角 · 双动作版')
sprites=next(a for a in state['assets'] if a['kind']=='sprites' and a['quality']!='有问题' and model['id'] in a['parents'])
base=Path('D:/3d/模型/战术主角_双动作');version=0
while (base/f'v1.0.{version}').exists():version+=1
out=base/f'v1.0.{version}';version_name=out.name
for sub in ['交付','源文件','预览','文档','验证']:(out/sub).mkdir(parents=True,exist_ok=True)
shutil.copy2(data/model['file'],out/'交付/operative_two_motions.glb')
shutil.copy2(data/sprites['file'],out/'交付/双动作序列帧_256px_6fps.zip')
shutil.copy2(data/sprites['blend'],out/'源文件/主角双动作与渲染场景.blend')
shutil.copy2(data/sprites['thumbnail'],out/'预览/主角.png')
shutil.copy2(data/sprites['renderManifest'],out/'预览/frames.json')
clips=model['metadata']['animations'];rows='\n'.join(f"| {c['name']} | {c['duration']:.6f} 秒 |" for c in clips)
guide=f'''# 战术主角双动作接入文档

版本：{version_name}；日期：2026-10-08；状态：已完成本地组合与序列帧产出，待游戏内观察。

入口：`交付/operative_two_motions.glb`。41 骨骼，99,530 三角面。动画、权重、UV、材质和贴图嵌入 GLB，无外部纹理依赖。GLB 的 UV/法线拆分后顶点数为 {model['metadata']['vertices']}，与源 GLB 一致。

| 实际动作名 | GLB 时长 |
|---|---|
{rows}

合并保留源采样时间，首个键可能稍晚于零；时长按 GLB 播放时间轴末端计算。没有为循环裁剪动作，没有镜像和调速。根运动保持原样。默认按单次播放；若要循环，请先观察首尾是否衔接。

## Godot 接入

1. 将 GLB 复制到项目 assets 中，等待 Godot 正常导入。
2. 实例化场景，查看 AnimationPlayer 中以上两个动作。
3. 先播放单个片段，检查手指、膝盖、装备和脚底接触。这些动作的原始绑定质量未作人工重绘修正。
4. 若要由 CharacterBody3D 控制位移，明确选择根运动提取或原地变体；本文件未自动移除位移。
5. 两动作共用同一骨架。旧自制 27 骨架版本不能按骨名直接复用；新增人物需要先适配。

## 序列帧

ZIP 内含两个动作的透明 PNG、分页图集、frames.json 和离线 preview.html。256px/6fps 是快速流程样例；工作台可以用 512px/24fps 重做。
同批动作共用相机、世界原点与归一化 pivot。行走的空间位移仍在，因此静止拳击在整体取景中占比偏小。这是保留两动作位移与共同尺度的结果。

## 来源、回滚

角色来自用户 Lux3D 原模型。两个动作来自用户提供的 Mixamo FBX，未添加自制动作。遵守原网站条款，用于自身游戏；不将原始动作数据再分发为素材库。来源路径与哈希见版本清单。回滚可使用项目资产库中的各单动作原版，本次未覆盖它们。

本轮没有测试套件或 Godot 游戏内验收；浏览器自动查看因 Windows ACL 工具故障未完成。仅记录实际执行的资产读取、组合和渲染。
'''
(out/'文档/接入文档.md').write_text(guide,encoding='utf-8')
(out/'文档/引擎接入指南.md').write_text('# Godot 接入\n\n详见 [接入文档](接入文档.md) 的 Godot 接入步骤；不改变现有游戏工程。\n',encoding='utf-8')
(out/'文档/版本记录.md').write_text(f'# {version_name}\n\n2026-10-08：同骨架复制已有拳击、行走转身到一个 GLB。保持目标网格原始二进制和材质，附 44 帧快速序列样例。没有修改面部或增加动作。\n',encoding='utf-8')
shutil.copy2(root/'docs/来源许可.md',out/'文档/来源许可.md')
manifest={'date':'2026-10-08','version':version_name,'model':model,'sprites':sprites,'sourceAssets':[a for a in state['assets'] if a['id'] in model['parents']]}
(out/'文档/版本清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'验证/实际执行记录.md').write_text('# 实际执行范围\n\n- 前端构建完成。\n- 两个已有 GLB 动作按匹配静止骨架组合完成。\n- Blender 按动作名称渲染 44 帧，打包透明序列帧与图集完成。\n- 检视了渲染 PNG，并修正了首次动作排序错误；旧样例标记有问题。\n- 未运行自动化测试套件、未进行 Godot 游戏内验收、未完成浏览器自动点击验收、未新增收费生成。\n',encoding='utf-8')
(out/'README.md').write_text(f'# 战术主角双动作 {version_name}\n\n[接入文档](文档/接入文档.md) · [GLB](交付/operative_two_motions.glb) · [序列帧 ZIP](交付/双动作序列帧_256px_6fps.zip)\n\n含用户已有拳击与行走转身动作。保留原网格和贴图，待游戏内观察。\n',encoding='utf-8')
lines=[]
for f in sorted(out.rglob('*')):
 if f.is_file():lines.append(hashlib.sha256(f.read_bytes()).hexdigest()+'  '+f.relative_to(out).as_posix())
(out/'SHA256SUMS.txt').write_text('\n'.join(lines)+'\n',encoding='utf-8')
index=Path('D:/3d/产物索引.json');items=json.loads(index.read_text(encoding='utf-8-sig'));items.append({'素材':'战术主角_双动作','类别':'模型','版本':version_name,'归档日期':'2026-10-08','状态':'双动作已组合；待游戏内观察','目录':str(out),'游戏运行验证':'未执行'});index.write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding='utf-8')
with Path('D:/3d/产物索引.md').open('a',encoding='utf-8') as f:f.write(f'\n资产工坊主角：[战术主角双动作 {version_name}](模型/战术主角_双动作/{version_name}/README.md)，41 骨骼、99,530 三角面，拳击与行走转身；附透明序列帧样例。\n')
print(str(out))
