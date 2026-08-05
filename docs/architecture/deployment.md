# 部署方案

## 架构

采用**纯 Node.js 单镜像**方案：Express 同时托管前端 SPA 静态文件和后端 API/WebSocket，无需 Nginx。

```text
Docker 容器 :3001
├── /                 → client/dist 静态文件（Vite 产物）
├── /api/*            → Music Together REST API
├── /uploads/avatars  → 上传头像静态文件（来自 /app/data/avatars）
└── /socket.io/*      → WebSocket
```

幻想音乐杯是独立项目，运行于 `http://47.94.44.206:3002/`。它拥有独立的仓库、容器、媒体目录和部署工作流；Music Together 仅在首页提供固定外部链接。

## CI/CD 流程

1. push 到 `main` → GitHub Actions 构建 Docker 镜像 → 推送到 GHCR（`ghcr.io`）
2. `deploy` job 通过 SSH 把镜像 SHA 和公开端口传给 `scripts/deploy-production.sh`
3. 部署脚本串行加锁、拉取镜像、重建容器并检查本机 3001 健康状态

GHCR 使用仓库自带的 `GITHUB_TOKEN`，远程部署使用 `MUSIC_SSH_PRIVATE_KEY` 与 `MUSIC_SSH_KNOWN_HOSTS` Secrets，以及可选的主机、用户、SSH 端口和应用端口 Variables。

## Docker 多阶段构建

- **阶段 1（deps）**：`pnpm install --frozen-lockfile` 安装全部依赖
- **阶段 2（build）**：依次构建 shared、server、client
- **阶段 3（production）**：仅安装 server 及其 workspace 生产依赖，并复制三个包的构建产物

## 持久化数据

房间、成员、聊天、用户资料、账号密码哈希、头像和听歌统计保存在 SQLite 与 `/app/data` 目录下：

- `DATA_DIR=/app/data`
- `DATABASE_PATH=/app/data/music-together.sqlite`（默认）
- `AVATAR_DIR=/app/data/avatars`（默认）

生产容器必须挂载 Docker volume 到 `/app/data`，否则部署脚本重建容器会删除数据库和头像文件。

## 磁盘边界与备份

- 音乐文件不会下载或缓存到服务器磁盘：服务仅返回上游播放 URL，歌词与封面缓存均在进程内存中；封面代理只在请求期间转发响应。
- 头像是唯一上传到 `/app/data/avatars` 的文件。每个用户只保留当前头像，替换或删除头像时会删除旧文件。
- 听歌统计默认保留 90 天；可用 `LISTENING_STATS_RETENTION_DAYS` 调整。过期事件及其成员快照会在启动和随后最多每 6 小时清理一次。
- 生产容器使用 Docker `local` 日志驱动，并限制为 3 个 10 MiB 文件；部署后只保留当前镜像和两个历史镜像。
- 应用不会自动创建本地备份，因此不会因备份累积占满磁盘。若配置外部备份，备份目录必须位于 `/app/data` volume 之外，并由备份任务自行设置保留天数和数量上限。

## CORS 策略

- `CLIENT_URL` 未设置 → 自动模式，允许浏览器报告的来源（适用于单镜像同域部署、局域网、公网反代）
- `CLIENT_URL` 显式设置 → 严格白名单模式
- `CORS_ORIGINS` → 额外允许来源，以逗号分隔

## Identity Cookie 策略

- 生产环境必须固定 `IDENTITY_SECRET`；更换密钥会让现有用户身份 cookie 失效，导致用户资料与房间成员身份无法自动匹配
- 部署脚本会读取服务器上的 `/opt/music-together/.env`（如果存在），建议在该文件中配置 `IDENTITY_SECRET`
- 未显式设置 `IDENTITY_COOKIE_SECURE` 时，服务端会根据当前请求协议自动决定是否添加 `Secure`
- 局域网 HTTP 访问会下发非 Secure cookie
- 公网 HTTPS / 反代 HTTPS 访问会下发 Secure cookie
- 自动判断 HTTPS 依赖代理正确透传 `X-Forwarded-Proto`
- 仅在需要强制行为时才手动设置 `IDENTITY_COOKIE_SECURE`

## 前端同域适配

`SERVER_URL` 默认使用 `window.location.origin`，同域部署时自动指向当前页面的 origin，无需配置。

## 静态文件托管

`packages/server/src/index.ts` 在启动时检测 `client/dist/index.html` 是否存在：

- **存在**（生产环境）：挂载 `express.static` 与 SPA fallback
- **不存在**（本地开发）：跳过静态托管，由 Vite 开发服务器提供前端

## 服务器部署命令

```bash
docker run -d \
  --name music-together \
  --restart unless-stopped \
  --log-driver local \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -p 3001:3001 \
  --env-file /opt/music-together/.env \
  -e DATA_DIR=/app/data \
  -v music-together-data:/app/data \
  ghcr.io/<owner>/music-together:latest
```

正常生产部署由 GitHub Actions 调用 `scripts/deploy-production.sh` 完成；上述命令仅用于手动恢复或首次验证。使用 1Panel 时，反向代理只需指向 `127.0.0.1:3001`，并启用 WebSocket 和 HTTPS。
