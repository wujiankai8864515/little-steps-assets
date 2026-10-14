> 历史设计记录。当前实现与边界以 [系统全景与实施路线](系统全景与实施路线.md) 和实施进度为准。

# 以全局 Skill 为主要入口的资产服务

日期：2026-10-09。用户本次明确授权一次独立 AI 审核，之后未经新命令不再调用审核代理。

## 目标和现状

全局 `asset-workbench` 是 Codex 的主要入口，网页负责资产查看、预览、取景和便捷操作。两个入口共用本机服务、SQLite、原始文件和任务队列。不需要 GPT API。后续项目中的 AI 可以从玩法需求出发，检索形象供用户选择、补模型/骨架/动作缺口、组装并接入当前游戏；执行路径和不足处理写入技能参考。

现有服务已有 import、preview、compose、render、quote/submit 和任务 API；网页与 CLI 已共用数据。缺口是：Skill 检索只能拉取整个 state；模型与动作载体混杂；当前网页相机只保存在浏览器；所见即所得捕获依赖打开网页操作；全局技能调用缺少稳定的精简目录和明确的结果契约。

## 一、单一资产目录

SQLite 中的资产和任务是事实来源。搜索实时派生目录，不在全局技能目录维护另一份资产列表，也不把用户 FBX 复制到技能文件夹。

| 实体 | 引用 | 主要关系 |
|---|---|---|
| 模型 | `model:<assetId>` | 原包、前一版本、骨架、贴图、已有片段 |
| 动作 | `motion:<sourceAssetId>:<clipIndex>` | 原始片段、来源模型、骨架、名称、时长、许可、试播记录 |
| 骨架 | `skeleton:<rigSignature>` | 使用同一静止骨架签名的资产；签名相同不是质量通过 |
| 贴图 | `texture:<assetId>:<imageIndex>` | 所属模型、原 GLB 图片索引、获取地址 |
| 序列帧 | `sprites:<assetId>` | 来源模型、片段、构图、尺寸、帧率和 GIF/PNG ZIP |

动作来源沿 `motionOrigins` 或旧 compose 任务还原。相同来源的派生副本合并展示；不同模型提供的同名动作保持独立。

模型用途使用持久字段 `usageRole`：`character` 对外模型、`motion-source` 动作展示模型、`working` 中间/历史版本。模型选择器和默认 Skill 模型搜索只返回对外模型。Mixamo 导入默认为动作来源，用户可明确把带网格的来源模型设为对外模型。

兼容旧数据时先保存元数据备份，识别来源/历史版本并保留一个最近已组装角色供继续使用。后续不再通过名称重算用户设置。模型动作增删产生新 GLB，旧版本归档；源动作不删除，几何和贴图二进制保持。

## 二、全局调用契约

全局入口：`node <全局 skill>/scripts/workbench.mjs <command> request.json`。入口只负责定位工作台、在未启动时启动本机服务、转发命令。CLI 和可选 MCP 使用同一个命令表。

- `search`：关键字、实体类型、分页、可选目标模型；返回精简条目、稳定 ref、assetId/index、来源、许可、质量和可预览链接。中文动作名、英文下载名、声明的 tags/aliases/description 均可搜。调用者 AI 扩展关键词并判断外观，不冒充语义检索。
- `plan / plan-status`：保存玩法需求、模型候选、动作职责和选择，查询缺口与关联任务。只是需求记录，不另建工作流引擎、不自动生成或收费。
- `inspect`：按 ref/id 读取详情、依赖与文件路径。只在需要时展开骨骼/贴图等大量数据。
- `import`：保留原始包，标明用途与来源，返回 job。
- `preview / preview-status`：实际目标试播，不伪装已适配。
- `compose`：接收明确资产 ID/片段索引或 motion refs；保留原动作，复用目标试播缓存，生成新模型并登记资产。
- `role / remove-motions`：修改模型用途；移除指定片段但保留历史与来源。
- `quote / submit / resume`：沿用现有 Lux3D 提供方，实时报价和实际授权分开。重试不得重复收费。当前开发不发起新收费生成。
- `frames`：Skill 发起基于网页同一渲染器的序列帧任务，支持一个模型的多个片段，共用选定构图；完成后 GIF、PNG、图集和清单自动入库。
- `render`：保留原 Blender 批量渲染路径，明确标明与网页当前构图渲染的区别。
- `job / wait / cancel / retry`：持久进度；wait 单次有时间上限，超时返回仍在运行，不伪报成功。

搜索不会按同名擅自选择版本。Codex 结合用户要求、来源预览和目标预览选择；无法适配/缺少动作时返回可继续的任务与网站步骤。Mixamo 的用户登录/标记/下载仍允许人工参与，不增加私有网站 API 破解。

## 三、序列帧共享

网页构图确认后把 view、size、fps 作为共享预设保存到服务，引用模型内容哈希。Skill 可按预设 ID 或明确相机参数调用；没有预设时只有明确 viewMode=default 才采用默认固定取景，整段动作是否裁切尚未确认。用户说“按我看到的”但没有共享构图时，返回取景页面，不猜测浏览器画面。

Skill `frames` 创建父任务，受控的本机无头 Chrome 加载专用捕获入口，复用 `Viewer` 与 `captureViewFrames`；捕获到的 PNG 交给现有 render-view 编码队列。任务按片段跟踪、复用缓存，成功输出登记到同一资产库。网页打开不触发渲染，用户调整相机也不触发 GIF，只有确认按钮发起捕获。

不增加新的渲染服务/云依赖。不改变动作速度、根运动和模型拓扑。捕获任务设超时、传播失败，浏览器最终关闭。GIF 是预览，原 PNG 是交付数据。

## 四、状态、版本与交付

任务返回 `id/state/stage/done/total/outputs/error`；只有 succeeded 且实际输出存在才交付。中断本地任务可重试；未知远端提交先查原任务。网页轮询和 Skill 读取同一记录。

目录响应附 revision，以服务当前数据计算；不采用离线静态 ID 列表。资产使用不可变 UUID 与原包 SHA256，模型更新使用 modelRevisionOf/modelReplacedBy；不滥用材质修复的 supersededBy，以免动作索引变动破坏来源映射。

## 五、实施顺序

1. 完成已答应的四项修复：新动作显示、用途分类、模型移除动作、手动 GIF。
2. 建立精简目录 search/inspect，支持来源关系和动作 ref。
3. 统一 CLI/MCP，增加全局自启动入口及完整调用文档。
4. 保存共享构图，增加 Skill 的同渲染器 frames 任务。
5. 构建并实际处理已有资源；记录真实产物和能力边界，不发起收费任务，不新增测试套件。

## 伪代码

```text
search(request):
  assets, completedJobs = read_database()
  origins = resolve_motion_origins(assets, completedJobs)
  entities = models + canonical_motion_clips + skeletons + textures + sprites
  return filter_and_page(entities, request), current_revision

compose(request):
  target = resolve_model(request.modelId)
  picks = resolve_explicit_motion_refs(request.motions)
  job = persist_queued_request(target, picks)
  worker:
    for pick in picks: await real_target_preview(target, pick)
    output = merge_target_mesh_with_preview_clips()
    register(output, origins=picks, previous=target)
    publish_new_version_and_keep_previous()
    mark_succeeded(output_ids)

frames(request):
  target, clips = resolve_exact_assets_and_clips(request)
  view = explicit_view OR shared_confirmed_preset OR declared_default_view
  if request.requires_user_view AND no_confirmed_view: return needs_input
  persist_job()
  persist_each_clip_state_and_resume_successful_items()
  for clip in clips:
    if exact_frame_cache_exists: reuse()
    else: capture_with_shared_viewer_in_local_browser()
    await encode_and_pack_original_png_frames()
    register_sprites_asset_with_model_motion_view_lineage()
  if cancelled: stop_owned_capture_and_encoding(); keep_successful_outputs()
  if any_failed: persist_failed_list(); preserve_outputs_for_retry()
  else: mark_succeeded(all_outputs)

global_skill(user_request):
  ensure_local_service()
  query_current_catalog()
  select_explicit_refs_and_call_production_commands()
  follow_job_until_complete_or_specific_external_input_needed()
  return verified_asset_ids + local_files + preview_url
```
