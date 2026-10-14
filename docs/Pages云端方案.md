# Little Steps · Pages 云端方案

2026-10-14 用户指定：只使用公开仓库 `wujiankai8864515/little-steps-assets`，代码留在 Mac，3D、2D 和其他素材保存在 GitHub，前端部署到 Pages。本文覆盖旧 Windows 本机工作台作为默认入口的约定；原源码与历史记录保留。

## 当前结构

| 位置 | 内容 | Mac 是否同步 |
|---|---|---|
| `main` | ZIP 原源码、`web/` 云端前端、部署配置、文档 | 是，仅此分支 |
| `asset-library` | `catalog.json`、`assets/` 原文件和产物、部署触发配置 | 否 |
| GitHub Actions 临时运行机 | 从两条分支取代码和资源，构建并合并发布目录 | 否 |
| GitHub Pages | 网页，以及 `library/assets/…` 的模型、图片、GIF、ZIP | 浏览器按需读取 |

入口：https://wujiankai8864515.github.io/little-steps-assets/

Pages 是发布服务。持久写入使用 GitHub Git Database API，原文件与目录在一次提交中原子发布；资源分支的轻量工作流通知默认 main 分支，由受保护的 main 工作流自动发布。并发更新使用非强制更新并重新合并目录，不覆盖他人的提交。

本 Mac 的远端获取配置仅包含 `main`，并关闭自动获取 tag。新电脑使用 `git clone --single-branch --branch main git@github.com:wujiankai8864515/little-steps-assets.git`。不要合并资源分支或执行全分支镜像克隆。

## 使用流程

1. 打开网页，可直接浏览公开库存，或导入素材做临时预览。
2. 上传或保存前点击“连接 GitHub”。Fine-grained token 只选本仓库，Contents 设为 Read and write。令牌仅在页面内存中使用，不写入源码、目录、localStorage 或 cookie。
3. 导入时填写独立素材名称。GLB 保留原二进制；FBX/glTF 提供标准 GLB 预览，原文件或完整源文件 ZIP 一并保留。
4. 卡片内预览库存，明确点击“在工作台使用”后选择制作模型。原始模型、动作试播、序列帧构图相互独立。
5. 选用精确动作片段。同静止骨架直接组合；不同骨架交给 Mixamo/Blender 适配后导回，不声称通用自动重定向。输出保留原模型二进制网格、蒙皮和内嵌贴图。
6. 浏览器生成透明 PNG、分页图集、GIF、帧时间/锚点 JSON 与离线 HTML 预览 ZIP。确认后直接上传 GitHub，不自动下载到 Mac。
7. Pages 部署完成后，复制资源网址给游戏加载。只有主动点击“下载”，才会保存本机副本。

导入窗口的 256×256、6 fps 临时 GIF 用于快速检查；未自动入库。正式工作台可选择 256/512/1024 和 6/12/24/30 fps，总帧数最多 720。资源均初始标记“待查看”，处理成功不等于质量验收通过。

## 存储与运行边界

- Published Pages 上限 1 GB，当前资源预算 900 MB，保留网页余量；单文件 40 MB。达到预算会拒绝目录提交。后续大文件可迁往 Releases 或对象存储，不能承诺 Pages 无限容量。
- 浏览器资源请求使用 `cache: no-store`，无 Service Worker、IndexedDB 或本地资源文件库。临时预览和编码需要浏览器内存；操作系统可能管理内存交换与临时缓存，不能保证系统层面零字节写盘。
- `localStorage` 只保存工作台名称、资源标识、动作索引与相机等少量界面配置，不保存素材二进制或令牌。
- 此仓库和 Pages 均公开。资源名称、原文件、历史版本和生成产物可公开访问；新 token 不带工作流写入权限，也不用于访问其他仓库。
- 页面优先从 Pages 读取已发布资源；新保存而尚未发布的资源通过 GitHub 的 CORS Blob API 读取，避免依赖 raw 域名在当前网络的可达性。
- Pages 不运行 Node、SQLite、Blender 或 Python。原 `server/worker/skill` 的本机功能保留在源码中，但不宣称已经在 Pages 运行。
- Lux3D 收费模型生成、通用动作重定向、自动绑骨及云端 Blender 任务尚未迁入 Pages 工作流。未提交任何收费生成。本版可生成 2D 素材，并导入现成 3D 资源。
- 原 ZIP 没有模型、动作或数据库；初始资源库为空，不补入未经用户选用的演示素材。

## 本地代码维护

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run dev:pages
pnpm run build:pages
node scripts/cloud.mjs list
node scripts/cloud.mjs inspect ASSET_ID
node scripts/cloud.mjs url ASSET_ID
```

`cloud.mjs` 仅读取公共目录和资源网址，不下载模型。`npm ci` / `npm run build` 构建当前 Pages 网页。原本机前端使用 `npm run build:local`（dist-local）与 `npm run start:local`。`library.yml` 通知工作流在两条分支保持一致；`pages.yml` 发布工作流只由受保护的 main 分支执行，所有资源合并仅在 GitHub 运行机完成。

原 `代码包清单.json` 是 2026-10-09 导入快照的校验清单。后续修改以 Git 提交为准；重新打包会生成新的校验清单。代码打包脚本包含 `web/` 与部署 YAML，并排除资源目录。
