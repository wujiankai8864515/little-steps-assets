# 从游戏需求到可接入资产

## 1. 先拆玩法，不先下载

读取当前游戏项目约定、引擎版本、已有角色控制器和资源目录。确认请求是只交付资产还是要接入；从已有项目推断，只有实质影响结果的缺项才问。把动作写成职责表：名称、是否循环、是否原地、触发条件、优先级、使用武器。不要自造不存在的攻击/受击动作填表。

“古代持刀士兵常规动作”的候选职责：持刀待机、行走、奔跑、普通挥砍、受击、倒地；格挡、翻滚、跳跃仅在玩法需要时补充。单手刀和双手大刀不是同一套手势。不能把空手拳击、走秀转身当作合适的持刀战斗动作。武器可能独立挂到手骨，需要检查实际握持和骨骼；脚底、重心、刀与身体穿插需要在目标上看。

可创建 plan（只登记需求，不生产）：

```json
{
  "title":"古代持刀士兵",
  "engine":"Godot（版本从项目读取）",
  "modelQueries":["古代 士兵","medieval soldier","warrior"],
  "constraints":{"weapon":"单手刀","style":"按当前游戏美术","rootMotion":"按现有控制器决定"},
  "motions":[
    {"key":"idle","label":"持刀待机","queries":["剑 待机","sword idle","持刀"],"required":true},
    {"key":"walk","label":"持刀行走","queries":["剑 行走","sword walk","行走"],"required":true},
    {"key":"run","label":"奔跑","queries":["sword run","奔跑"],"required":true},
    {"key":"attack","label":"普通挥砍","queries":["剑 攻击","sword attack","slash"],"required":true},
    {"key":"hit","label":"受击","queries":["受击","hit"],"required":true},
    {"key":"death","label":"倒地","queries":["倒地","death"],"required":true}
  ]
}
```

plan 可以检索待选素材，但返回 selectionStatus；候选只是匹配，不是用户审核或自动选用。inspect 和预览后，展示 2–4 个合适形象让用户选择。用户已经指定模型时直接使用其精确 ID。模型不合适时先描述差距，不为省步骤强行套用。

## 2. 补模型、骨架与动作

没有合适形象时，准备完整提示词/参考：全身、干净背景、中性 T/A 姿势、双手与腿分开、目标服装时代、武器是否独立、风格和细节保护。调用 quote 查看当前价格；按本次具体授权调用 submit。图片 quote 可能会上传所选参考到 Lux3D。开发或检索授权不等于生成费用授权。

生成模型若没有骨架，先完成绑定。已有动作先本地复用；缺少或不适合时，在 `/?panel=mixamo&model=ID` 引导用户上传、标记、选择、下载。回库每个独立 FBX 一个 import，usageRole=motion-source，附 handoffModelId 和可用的 handoffJobId。没有“下载成功”或原文件证据时不能声称已入库。需要其他来源时读取项目成熟工具调研与许可说明。

更新 plan 时传同一 id、所选 modelId，单项选择用 motionSelections:{职责key:精确ref}；motions 默认按 key 合并，replaceMotions=true 才替换整表。请求中的约束是后续 AI 需核对的要求，不是服务已经检查通过的结论。

## 3. 试播、组装与交付

对选中版本调用 preview，跟踪 preview-status；比较来源与目标的节奏、握持、骨骼变形、根运动。已知 FK 适配不保证脚底固定。可保留多个攻击片段，但它们是独立片段；合并不等于上下半身混合。

compose 传清晰动作名及精确 refs，并附 planId。跟踪实际 job；succeeded 后 inspect 输出模型，记录动作职责 → 新模型片段 index/name → 原动作 ref。默认 keepExisting=false，仅组装明确选用的片段；不要因原文件带有演示动作就全数保留。面向工作台使用 workspace-compose/complete，同步精确选用记录。

要序列帧时：先保存确认构图，再 frames；同一模型多个片段可共用视角。默认固定取景不保证整段不裁切。PNG 为交付数据，GIF 只作预览。

## 4. 接入当前游戏

用户要求接入时，把已完成的 GLB/帧资产复制到项目约定的资源目录，保留原资产库文件。遵循引擎导入机制；先检查已有动画状态机、角色朝向、比例、地面原点、移动速度、循环和根运动策略，再做最小连接。选择已存在片段，不通过程序摆骨伪造缺失动作。

攻击命中帧、碰撞范围、格挡生效窗口和死亡后逻辑属于游戏配置，应根据实际片段时长与玩法核对；不能把它们宣称为模型自动包含的能力。按用户是否要求运行/验证执行相应检查，构建通过不是玩法通过。

先用 handoff 生成统一 JSON 和中文使用说明，再在项目约定位置交付 `asset-workbench-handoff.json`，含 libraryId、planId、model ref/hash、本地资源路径、motionMappings、licenseSources、rootMotionPolicy、未完成项和下一步。用户只要资产时返回这些信息，不擅自修改游戏。

继续任务时先 plan-status/job/inspect，保留已完成产物；不能因换了 AI 就重复付费生成或重复下载已有动作。
