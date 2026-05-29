# 部署方案

## 架构

采用**纯 Node.js 单镜像**方案：Express 同时托管前端 SPA 静态文件和后端 API/WebSocket，无需 Nginx。

```
Docker 容器 (:3001)
├── / 静态文件        → client/dist（Vite 产物）
├── /api/*           → REST API
├── /uploads/avatars → 上传头像静态文件（来自 /app/data/avatars）
└── /socket.io/*     → WebSocket
```

## CI/CD 流程

1. **push 到 main** → GitHub Actions 构建 Docker 镜像 → 推送到 GHCR（`ghcr.io`）
2. **服务器上** Watchtower 每 5 分钟检查镜像更新 → 自动拉取并重启容器

零人工干预，GitHub 零额外 Secrets（使用自带的 `GITHUB_TOKEN`）。

## Docker 多阶段构建

- **阶段 1（deps）**：`pnpm install --frozen-lockfile` 安装全部依赖
- **阶段 2（build）**：分别构建 shared、server（tsc）、client（vite build）
- **阶段 3（production）**：仅安装 server 生产依赖（`--filter @music-together/server...`），复制构建产物

## 持久化数据

房间、成员、聊天、用户资料、头像和听歌统计保存在 SQLite 与 `/app/data` 目录下：

- `DATA_DIR=/app/data`
- `DATABASE_PATH=/app/data/music-together.sqlite`（默认）
- `AVATAR_DIR=/app/data/avatars`（默认）

生产容器必须挂载 Docker volume 到 `/app/data`，否则 `docker rm -f` 或 Watchtower 重建容器会删除数据库和头像文件。备份时同时备份 SQLite 数据库文件、WAL/SHM 文件和 `avatars/` 目录。

## CORS 策略

- `CLIENT_URL` 未设置 → 自动模式，允许所有来源访问（适用于单镜像同域部署、局域网、公网反代）
- `CLIENT_URL` 显式设置 → 严格白名单模式（适用于前后端分离跨域部署）

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

- **存在**（生产环境）：挂载 `express.static` + SPA fallback
- **不存在**（本地开发）：跳过，零影响

## 服务器部署命令

```bash
# 创建持久化数据卷
docker volume create music-together-data

# 启动应用容器
docker run -d --name music-together --restart unless-stopped \
  -p 3001:3001 \
  --env-file /opt/music-together/.env \
  -e DATA_DIR=/app/data \
  -v music-together-data:/app/data \
  ghcr.io/<owner>/music-together:latest

# 启动 Watchtower 自动更新
docker run -d --name watchtower --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e WATCHTOWER_CLEANUP=true \
  containrrr/watchtower --interval 300 music-together
```

如使用 1Panel，创建反向代理网站指向 `127.0.0.1:3001`，启用 WebSocket 和 HTTPS。
