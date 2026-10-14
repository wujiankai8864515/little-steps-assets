# CLI/MCP 请求字段

全局入口：`node C:/Users/Admin/.codex/skills/asset-workbench/scripts/workbench.mjs COMMAND request.json`。示例路径以当前用户实际 Skill 为准。自动启动或复用已配置服务并核对 libraryId、程序与数据路径。项目 CLI 与 MCP 共用业务命令定义；生命周期命令由全局入口提供。
MCP：`asset_workbench({command:COMMAND,arguments:JSON对象})`。

| 命令 | JSON 请求 |
|---|---|
| library | `{kind:"model"或"motion"或"sprites",q?,offset?,limit?}`。与三类网页库存一致，模型按来源归组，含版本 ref 与卡片 previewUrl；仅查询，不选用。 |
| search | `{"kind":"model或motion或skeleton或texture或sprites或image或all","q":"行走","limit":20,"offset":0}`；可加 modelId 查看目标试播状态、includeHistory 或 usageRole。返回 libraryId/revision/ref。|
| inspect | `{"ref":"motion:原资产ID:0"}` 或 `{"id":"资产ID"}`。精确读取，不切换版本。返回实际路径、SHA256、来源许可、贴图/骨架关系和构图预设。|
| plan | 见 gameplay-workflow.md。title/modelQueries/motions 创建需求记录；同一 id 可更新 modelId 与所选 selectedRef。约束由调用者 AI 核对，候选不等于适用性通过。|
| plan-status | `{"id":"需求 ID"}`。返回候选、缺口、所选片段和关联 job。|
| plans | `{"q":"士兵","limit":20}`；可加 stage，按名称找回需求。|
| motion-quality | `{"modelId":"目标ID","ref":"motion:源ID:0","previewId":"真实成功预览ID","status":"usable或issue或unknown","purpose":"持刀行走","notes":"查看结论","evidence":["真实图片路径或报告引用"]}`。按目标哈希/源哈希/适配版本保存。|
| handoff | `{"modelId":"成品ID","spriteSetIds":[],"spritesIds":[],"reviewIds":[],"planId":"可选计划ID","engine":"实际引擎","motionMappings":[{"role":"walk","index":0,"loop":true}],"rootMotionPolicy":"unknown","unresolved":[]}`；也可 refs 指定精确成品。返回 JSON/中文说明路径；没有自动修改游戏。|
| review-options | 无参数，返回可选 sprites 片段与历史校对。|
| asset-flow | `{modelId?}`。读取真实来源链、动作、2D 动作集和连线；网页 `/?panel=flow&flowModel=模型ID`。 |
| group-sprites | `{selections:[{assetId,clipIndex}],name?}`。同模型同构图归为 `sprite-set`，重复成员集复用。 |
| sprite-set | `{id}`。读取成员、原帧文件、源版本、锚点与当前播放顺序。 |
| sprite-playback | `{id,order:["序列帧ID:片段编号"],repeat:true}`。保存 1–30 段验收播放，可重复；不改原帧。 |
| onion-preview | `{spriteSetId}` 或 `{modelId,clips,presetId}` / 显式已确认 `view,size,fps`；也可 selections 或 assetIds。`preparing` 时 wait(job.id) 后同参重调；ready 得到 uiUrl 与 report；失败后显式 retry:true。 |
| flow-layout | `{modelId,positions:{节点ID:{x,y}}}`。保存画布布局，不能改数据依赖。 |
| review-frames | `{"selections":[{"assetId":"序列帧ID","clipIndex":0,"loop":false}],"intent":"direct或blend或anchors或loop","rootMotionPolicy":"preserve或in_place或unknown"}`；可传 pairs 指定比较帧。返回 job。|
| review-status | `{"id":"校对资产ID"}`，返回 evidence 图片路径、reportHash、分帧量测和真实 AI 判断。|
| review-result | 字段见序列帧与校对.md；要求 id、reportHash、verdict、四项 checks、带证据ID的 observations。调用者先看图，不能伪造通过。|
| generation-draft | `{}` 读；`{patch:{modelName?,prompt?,references?:[{assetId或jobId,name}]},clientId?,sequence?}` 写。图片最多 32 张、有序；只保存输入，lastJobId 由服务记录。 |
| sprite-preview | `{assetId,retry?:true}` 为旧 PNG 包补 GIF；ready 返回 url，preparing 返回 job。 |
| quote-status | `{"quoteId":"原报价ID"}`。获取既有 job/远端任务；提交超时先查这里，不能重新发一单。|
| state / settings | 不需要文件。state 含完整历史，仅需要全量诊断时使用。|
| role | `{"id":"模型ID","usageRole":"character或motion-source或working"}`；角色用途与工作台选用独立；工作台列表只放明确命名的工作台。|
| annotate | `{"id":"资产ID","description":"已确认描述","tags":["士兵"],"aliases":["soldier"]}`，用于后续检索；不更改文件。|
| remove-motions | `{"modelId":"对外模型ID","indices":[1,3]}`，返回制作 job，保存新模型版本，保留原动作源与历史。|
| import | `{"paths":["D:/.../hero.glb"],"name":"主角","source":"来源","license":"许可","usageRole":"character"}`。有依赖时 paths 列全部文件、basePath 为包根路径、entry 为包内入口路径。|
| preview | `{"modelId":"目标模型 ID","ref":"motion:源ID:42"}`；也支持 assetId/index。search 的 previewRequest 可原样使用；失败且适合重试时可加 retry:true。可传 planId。|
| preview-status | `{"id":"preview 返回的 ID"}`。queued/running 继续等待；succeeded 的 url 为轻量试播片段，不能当作包含模型的成品交付。|
| compose | `{"modelId":"ID","name":"角色双动作","planId":"可选需求ID","motions":[{"ref":"motion:ID:0","name":"attack"}]}`；也支持 assetId/index。默认 keepExisting=true。|
| upload | `{"modelId":"ID","unrigged":true,"textures":true}`。unrigged=false 保留骨架；true 使用静止网格移除骨架。缺骨骼默认带贴图导出；相同上传规格复用既有任务。|
| frames | `{"modelId":"ID","clips":[0,1],"presetId":"可选确认构图ID","planId":"可选需求ID"}`。默认复用同模型已确认构图；可直接传 view，或明确 `"viewMode":"default"`。返回可跟踪 job，每片段状态在 items，成功资产在 outputs。缺构图 needs_input。|
| save-view | `{"modelId":"ID","clipIndex":0,"size":512,"fps":24,"view":{"position":[1.75,1.6,4.3],"target":[0,0.83,0],"fov":33}}`。仅在用户确认该视图或明确要求采用该参数时保存。|
| render | `{"modelId":"ID","clips":[0,1],"settings":{"size":512,"fps":24,"azimuth":0,"loop":false}}` |
| view-cache | `{"modelId":"ID","clipIndex":0,"size":512,"fps":24,"view":{"position":[1.75,1.6,4.3],"target":[0,0.83,0],"fov":33}}`。只查询完全相同构图的已捕获任务；job 为 null 时调用 frames 或在网页确认生成，不能以 Blender 固定相机替代。|
| save-frames | `{"id":"render-view 任务 ID"}`。只保存 succeeded 任务的原 PNG、图集、GIF 和清单，返回可下载的资产。重复保存同一任务返回同一资产。|
| wait | `{"id":"job-id","timeoutMs":15000}`；最大 45 秒，超时保留真实 state，返回 timedOut。继续 wait，不把超时当完成。|
| job / cancel / retry | `{"id":"job-id"}`。retry 新建本地任务；frames 沿用原规格并复用已完成项。云端不重复提交。|
| quality | `{"id":"asset-id","quality":"待查看或可复用或有问题"}` |
| quote | `{"operation":"text-to-3d","prompt":"...","version":"G1","faceCount":100000,"name":"...","imageIds":[]}` |
| submit | `{"quoteId":"真实报价 ID","confirmCredits":真实报价数字}`。必须已有当前收费授权。|
| resume | `{"id":"生成任务 ID","taskId":"官方原任务数字编号"}` |
| profile | `{"sourceId":"动作源资产","targetId":"目标模型","resultId":"已标记可复用的适配结果","name":"适配记录","notes":"骨架工具/校准设置"}`。记录人工适配经验，不会自动推断映射。|

网站回传在 import 中加 `handoffJobId`，会自动关联原模型与需要处理任务。纯动作 FBX/BVH 可以导入，实际是否可直接合并取决于归一化后的静止骨架。

试播与打包必须使用相同 modelId / assetId / index。缓存按模型文件哈希、来源文件哈希、片段编号和适配版本隔离。compose 会自动等待或复用缓存，不要求调用者另传预览路径。预览记录与任务记录分开，预览不会占用 Blender 制作队列；网页在工作台“已选动作”框内播放目标/来源，点行前 ▶ 指定片段；原始模型框不播放动作。

序列帧每片段最多 720 帧；批量动作共用取景。根运动保留，不裁剪、不镜像、不改变动作速度。数据与源文件保存在绑定的 dataRoot；不要删除数据库后把文件存在当已登记。

网页所见即所得入口：工作台（旧 /?panel=frames 兼容进入工作台）。在序列帧节点的方形构图框中调角度与大小，点击确认后使用同一 Three.js 场景逐帧捕获。多个动作统一为右侧节点的 2D 动作集，直接洋葱播放；相机变化不会自动捕获。PNG 保留原 RGBA，GIF 仅作预览。workspace-onion 将已确认的请求记录到 workspace-renders，刷新可继续真实任务。

Mixamo 入口：`/?panel=mixamo`。多选 FBX 时网页逐文件调用 import，并附上 handoffModelId（当前模型）与可选 handoffJobId（准备上传任务）。文件原包逐个归档；不要将多个独立 FBX 当作一个依赖包而仅处理第一个入口。

MCP 注册示例（可选，CLI 已可调用）：

```toml
[mcp_servers.asset_workbench]
command = "C:/Program Files/nodejs/node.exe"
args = ["D:/godotGames/AssetWorkbench/scripts/mcp.mjs"]
```

工作台重启后未提交报价作废；有远端 ID 的生成任务继续查询；本地中断任务显示可重试。API 只绑定本机。

## 运行边界

`search / inspect / plan` 不调用 Lux3D，也不上传图片。图片模式的 quote 可能先上传所选参考图片；submit 才发起收费生成。网络超时不自动重复 submit，按 quote/job 和原 taskId 追踪。

frames 使用现有本地 Chrome 与 Codex 附带 Playwright；路径可通过 WORKBENCH_CHROME/WORKBENCH_PLAYWRIGHT 设置。一次只捕获一个片段；失败保存具体 items/error，保留成功资产，retry 继续。默认固定相机不承诺整段不裁切。需要网页所见即所得时，同一模型哈希的确认构图才可复用。

全局 Skill 安装/同步：在项目执行 scripts/install-skill.ps1。配置在全局 references/workbench.json；包含本机地址、程序/数据路径、协议版本、libraryId 和可选依赖路径，不包含服务 Key。CLI/MCP 的业务功能列表统一由 scripts/command-definitions.mjs 提供。

## 本机管理命令

help/location/doctor/open/stop 无请求文件。bind 接收 projectRoot、dataRoot、可选 baseUrl/libraryId/environment。pack 接收 output。restore 接收 archive+destination，或 archive+projectRoot+dataRoot。完整流程与成功边界见运行与迁移.md。

计划更新：motionSelections 按职责 key 改选择；motions 默认按 key 合并，replaceMotions=true 才整体替换。planId 在制作命令中关联需求，网站回传继承上传任务计划。

needs_input 可能有可用中间产物：upload 的 artifactsReady=true 表示 FBX 已生成，下一步去网站；不能只看父任务终态丢掉已完成输出。错误中的 code/nextAction 优先于猜测。只有连接、绑定、依赖问题使用 doctor。


## 工作台选用命令（2026-10-09）

完整字段见 [资产工作流](资产工作流.md)。新增 workspace-select、workspace-selection、workspace-compose、workspace-complete、workspace-export、workspace-onion。selection.revision 用于并发保护；精确模型哈希改变后不能沿用旧选用记录。

search 增加 includeCandidates:true（默认 false）；响应 selectionStatus、requiresUserSelection，动作另带 selectedForModels。已选用不是质量通过。plan 的查询可以包含待选，但不自动选用。通过角色标记或 raw compose 不能把未确认素材算作已审核。

## 工作台名字与草稿字段

workspace-select 首次或归档后新建：`{modelId,sourceHash,name:"用户给出的名字"}`，已有工作台仅切换可省 name。workspace-name：`{modelId,name}`，要求 1–60 字，不能替用户随意命名。

workspace-draft 读取：`{modelId}`。写入：`{modelId,sourceHash,patch,clientId?,sequence?}`。patch 支持 clip、chosen、knownClips、frameClip、view/modelView/motionView、size、fps、picker、query、sourceFilter、limit、candidate、sourceMode、mixamoOpen、request、autoKeep、closedReview、preparedSetId、viewport、positions、motionPlayback/framePlayback/onionPlayback。视角为 position/target/fov；播放为 clipIndex/time/paused；只发送变化字段。草稿不是制作授权或质量结论。

sprite-set 返回 downloadUrl 下载整套 ZIP，manifestUrl 下载 JSON。library 返回卡片内预览地址；确切版本仍使用 inspect。quote 的图片模式 imageIds 有序 1–32 张，纯文字模式至多一张可选参考；图片模式 prompt 只记录备注。

## 模型命名和绑骨导回

| 命令 | 请求及含义 |
|---|---|
| model-name | `{modelId,name}`；name 为 1–60 字，修改这个模型家族的卡片名称及版本名称。文件、哈希和工作台名称不变。 |
| rig-adopt | `{modelId,sourceHash,riggedId,riggedHash,confirmAppearance:true}`；先查看同一角色的导回预览再提交。导回必须来自该原模型的 riggingReturn 导入、含网格/骨骼/权重；原件有贴图而结果无贴图时拒绝接回。返回新 modelId 与原工作台状态。 |

独立模型 import 必须显式给 name；motion-source 动作和 image 参考图可沿用文件名称。quote 同样必须给 name；空名先拒绝，不发远程报价。generation-draft.modelName 可暂为空，但正式操作不能空。改名不修改原文件，不撤销已发出的收费任务。

无骨骼模型交接导入示例：`{paths:["D:/下载/WithSkin.fbx"],handoffModelId:"原模型ID",handoffJobId:"upload任务ID",riggingReturn:true,source:"Mixamo · 用户下载"}`。此处继承原模型名称，不新建独立模型名字。没有 upload 任务时可只提供 handoffModelId，仍必须经实际外部绑定并查看结果。With Skin 缺失会保留导入产物并返回 needs_input；不要重复 retry 同一个错误文件。

导回先登记为动作来源；明确 rig-adopt 后升为同家族的绑定版本，原模型进入历史。已有工作台继承 workspaceId、名字、镜头和布局，清空候选播放状态；没有工作台则只更新模型库。导回的动作不会自动勾选，继续逐片段试播确认。此动作不能代替网站绑骨，也不执行自动骨架生成或权重猜测。
