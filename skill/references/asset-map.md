# 资产引用、发现与缺口处理

资产真实目录在配置文件 `workbench.json` 指向的本机服务中。不要把当前模型 ID、动作清单复制为静态技能知识。看库存用 library 获取与网页一致的模型/动作/序列帧目录；制作筛选用 search；inspect 读取精确资源。

| ref | 含义 |
|---|---|
| model:UUID | 一个不可变的模型版本 |
| motion:UUID:INDEX | 该不可变 GLB 的一个原始片段，不能仅凭名字替换 |
| skeleton:SIGNATURE | 相同静止骨架签名的一组资产；不代表动作质量通过 |
| texture:UUID:INDEX | 模型中的图片索引，inspect 提供实际存储和可提取地址 |
| sprites:UUID | 序列帧资产及其来源、取景参数 |
| sprite-set:UUID | 同一模型同一构图的多动作 2D 资产，含每段帧包引用和当前验收播放顺序 |
| image:UUID | 可用于生成的原始参考图片 |
| review:UUID | 洋葱皮证据与对应 AI 判断 |
| handoff:UUID | 游戏交接 JSON 和中文说明 |

search 默认只返回已选用，includeCandidates:true 才包括待选。selectionStatus=selected/candidate 与 sourceQuality 分开；selectedForModels 表示动作在哪些模型被选过，不保证当前目标适用。历史/中间模型还需 includeHistory 或 usageRole。已选用的精确旧版本不会因 history 被隐藏。中文名称、英文原名、来源、描述、tags、aliases 都参与检索；这是关键词检索，不是语义模型。可由调用者用多个同义查询补足，例如“剑”“sword”“持刀”。不要因一次零结果就声称平台没有该类资源。

每次交接带 libraryId、ref、sha256。preferredRevision 只是建议，不改变精确引用。动作 ref 保存身份，carrierAssetId/carrierIndex 指向可用展示载体。不要把载体模型自动设为对外模型。适配质量需要目标试播，sourceQuality 不能替代 targetQuality。已看过的具体目标适用经验用 motion-quality 保存，改变模型/源哈希或适配版本后不自动沿用。

## 不足时的处理

| 情况 | 立即做什么 | 留给后续 AI / 用户的下一步 |
|---|---|---|
| 模型不符合时代、武器或美术风格 | inspect 候选缩略图/模型，记录缺项 | 展示候选或准备完整生成提示词与参考；quote 后按实际授权 submit |
| 没有模型 | 用 includeCandidates:true 扩大中英文模型查询 | 用户选择生成或导入；费用未授权时保留 plan，不偷偷生成 |
| 无骨架 | inspect boneCount 和源文件 | upload 生成网站兼容文件；打开对应 Mixamo 模块绑骨，再关联 import |
| 仅有骨架动作，没有外观 | 保持 motion-source | 用作动作源，寻找/生成带网格目标模型 |
| 没有指定动作 | 查同义名称、来源包和同类玩法动作 | 缺口仍在时引导 Mixamo/成熟备选；逐文件回库，再更新 plan |
| 骨架无法映射 | 读取 preview 的 needs_input/error | 同一目标上重新绑骨或用成熟重定向工具；回传明确关联目标，不乱改骨骼名强行通过 |
| 动作能播但不适合武器或玩法 | 比较原模型与目标试播，说明手势/根运动/节奏差异 | 换来源；不要把“能播放”标为已通过，不合格源仍可供其他用途 |
| 多个版本同名 | 保留原始 ref，给出少量对比 | 选择后再组装，禁止凭名字去重不同来源 |
| 模型白色/镂空 | 查贴图依赖、材质 alpha 和原包 | 恢复原材质，保留真实透明部分；不要通过减面处理材质问题 |
| 当前视角未确认 | 查 inspect.framingPresets | 引导网页确认；用户明确接受默认时才用 viewMode=default |
| 批量序列帧部分失败 | 读 job.items 和 outputs | 交代成功/失败各项，retry 复用成功结果 |
| 引擎导入、缩放、根运动不匹配 | 检查实际引擎版本和控制器 | 只修改接入层；保留原 GLB、来源、动作名映射，不覆盖游戏原逻辑 |
| 后端未启动/路径移动 | 使用全局启动器 | 定位失败核对 workbench.json，不创建第二个空库 |

跟踪记录至少包含：plan ID、模型 ref、玩法动作职责 → motion ref、待解决缺口、job IDs、成功输出、下一条可执行命令和必要的人类操作。不要只写“需要人工处理”。许可未明确时标 unknown，保留来源，不自行断言可商用。


## 卡片、版本与预览地址

library 的 kind 为 model / motion / sprites；模型返回 familyId、代表版本与 versions。卡片归组不改变精确资产 ref，名称或骨架相似不能作为合并依据。动作源的演示模型不会混进模型库。

previewUrl 打开资产库的对应卡片，在卡片内播放；有 clip 参数时为具体来源动作。动作库展示源动作，不等于它在目标模型上适配成功。工作台制作仍使用 preview / workspace-compose 的目标效果与人类选择。

sprite-set 的 downloadUrl 是真实 ZIP，manifestUrl 是集合 JSON。封面缓存、GIF 和模型家族关系随资产库迁移；封面或播放成功不代表任何质量已通过。

模型家族的 modelName 与工作台 name 独立。library.model 返回 rigState（missing/present）及缺骨骼 nextAction；asset-flow.model 同时带骨骼数量与 riggingUrl。绑定导回保留 handoffModelId/sourceHash，经 rig-adopt 才关联 modelRevisionOf/modelFamilyId 并接续工作台。不能把导入了有骨架的动作源误认为原模型已经绑定。
