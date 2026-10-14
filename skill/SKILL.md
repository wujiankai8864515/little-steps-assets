---
name: asset-workbench
description: 为游戏项目检索和提供可复用的 3D 模型与已有动作、组装多动作角色、制作 2D 序列帧并用洋葱皮校对衔接和锚点。处理模型、骨架、动作短缺，提供交付清单；支持共享资产库的打开、路径绑定和迁移。Codex 与中文网页共用资产，不依赖 GPT API。
---

# 资产工坊

这是跨项目资产服务的全局入口。网页是同一资产库的可视预览与便捷操作界面；自然语言理解和看图判断由调用此 Skill 的 Codex 完成。

## 先定位，再按需读一页

全局目录默认为 `$CODEX_HOME/skills/asset-workbench`，未设置 CODEX_HOME 时为用户目录 `.codex/skills/asset-workbench`。程序和数据地址在 [绑定文件](references/workbench.json)，不要假设资产与 Skill 在同一盘。

```powershell
node C:/Users/Admin/.codex/skills/asset-workbench/scripts/workbench.mjs help
node C:/Users/Admin/.codex/skills/asset-workbench/scripts/workbench.mjs location
node C:/Users/Admin/.codex/skills/asset-workbench/scripts/workbench.mjs COMMAND request.json
```

上面是本机默认安装示例；环境改变时使用实际 Skill 所在目录。请求保存为 UTF-8 JSON 文件。`help` 返回能力路由、实时命令名单；不要先读取整个数据库或所有文档。

| 需求 | 按需读取 |
|---|---|
| 三类资产卡片、工作台记忆、依赖、2D 动作集与播放顺序 | [资产工作流](references/资产工作流.md) |
| 玩法需求、查库、缺口与动作选择 | [索引](references/索引.md)、[从需求到游戏](references/gameplay-workflow.md) |
| 导入、模型生成、绑骨、动作组合 | [模型与动作](references/模型与动作.md) |
| 二维帧、构图、洋葱皮和 AI 判断 | [序列帧与校对](references/序列帧与校对.md) |
| 交付、另一个项目/AI 续接 | [交接与续作](references/交接与续作.md) |
| 打开/关闭网页服务、改盘、迁移 | [运行与迁移](references/运行与迁移.md) |
| 字段不确定 | [调用参考](references/operations.md)；能力索引中的完成条件和 nextAction |

## 共同约束

- 看库存先 library 按 model / motion / sprites 读取与网页一致的独立目录；制作前再 asset-flow 读取工作台选用范围，然后 search、inspect 精确 ref。search 默认只返回已选用；不足才用 includeCandidates:true 查待选。禁止把入库、任务完成、character 标记或模型自带动作当作用户已审核。少量候选在工作台“已选动作”框中试播，用户确认后加入，不抢先制作依赖项。
- 查库→补缺口→目标试播→已有动作组装→按需出帧/看图校对→handoff→当前游戏项目接入。模型、源动作、贴图和面部细节保留，不默认减面或编造新动作。
- 试播和组装使用同一个精确动作 ref；同名来源不等同。targetQuality 与源质量分开，不把能播放、任务成功当通过。
- 工作台操作优先 workspace-select / workspace-selection / workspace-compose / workspace-complete / workspace-export / workspace-onion；精确字段见资产工作流。调用选用命令前必须已有用户对具体模型/动作的选择，不能为了填满页面替用户选择。通用 compose 仅传已指定片段、keepExisting=false；只有用户明确要保留全部自带动作时才 true。
- queued/running 跟踪真实 job。needs_input 读 nextAction；上传 FBX 的 artifactsReady=true 是已完成的中间产物，应交给网站步骤。部分失败保留成功项，不误报整批完成。
- 收费 submit 必须有本次具体规格/报价授权。响应未知先 quote-status 找回原任务，不另提新单。网站登录/验证码/标记/选动作按现实人工交接，不虚构官方 API。
- 校对用原 PNG 证据，调用者看图后保存带 reportHash 的判断；无法判断的项写 not_assessed。不得逐帧重居中掩盖根运动或自动造过渡动作。
- 2D 的多动作产物统一为 sprite-set；沿 model → motion → sprites → sprite-set 记录真实依赖，播放顺序独立保存。优先用 onion-preview 直接展示指定动作；不让新人先配置报告，也不任意替换为其他模型的帧。
- 资产库分模型、动作、序列帧三类，封面可点击，在原卡片内播放；没有独立预览区，不自动跳工作台。模型按显式来源链合并版本，不能仅按名称/骨架去重；动作和序列帧保留各自来源。工作台仍是一条“静止模型 → 已选动作 → 序列帧”链，各节点内操作。
- 新建工作台必须有用户给出的 1–60 字名称；workspace-name 为旧台命名/改名，workspace-draft 读恢复状态，不代表选用或确认构图。组合继承 workspaceId 与草稿，更新模型版本，不能新增同名台。sprite-set.downloadUrl 下载真实整套 ZIP，manifestUrl 才是 JSON。
- Lux3D 生成参考用有序 imageIds，图片模式 1–32 张；不调用自动四视图。generation-draft 保存输入，不代表授权；关闭后只恢复原任务跟踪，不自动提交费用。公开接口未列绑骨操作，不声称 Lux3D 免费绑骨。
- 全局 Skill 与网页共用同一库。open 关闭已确认属于本库的旧空闲服务再启动；忙碌时复用，避免第二个进程。普通生产命令只复用/按需启动。资产迁移先打包并校验恢复，再绑定，保留旧库。
- 输出至少包含 libraryId、ref、sha256、真实文件、许可/质量状态、未完成项与下一步。只交付资产时不擅自修改游戏。
- 维护修改同时同步中文能力索引、相关使用页、总方案/进度与全局安装副本。资料中的外部工具价格/许可是带日期参考，实际消费前核对。
- 用户本次允许的三视角审核已完成并结束；未有新的明确指令，不再创建或调用其他审核/实施代理。

- 独立模型 import、生成 quote 的 name 必填，采用用户指定名称；model-name 修改同模型家族的名称，不改工作台名。无骨骼模型先 upload → 网站绑定 → import(riggingReturn=true) → 预览外观 → rig-adopt，后者继承当前工作台。不能只把绑定结果当动作源后宣称原模型已有骨骼；详细字段读“模型与动作”。
