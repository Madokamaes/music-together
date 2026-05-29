# Music Together

Music Together 是一个已经面向自托管场景改造过的在线多人同步听歌平台。它不再只是临时房间演示应用，而是支持长期运行的房间、持久用户资料、头像、聊天记录和听歌统计。

## 当前分叉的主要能力

- **永久房间**：房间会持久化到 SQLite，房主主动解散前不会因为没人在线或服务重启而消失。
- **成员离线保留**：加入过房间的用户会保留在成员名单中，离开后显示为离线。
- **隐藏房间与邀请链接**：房主可隐藏房间；隐藏后不出现在大厅，但完整房间号或 `/room/:roomId` 邀请链接仍可加入，房间密码规则不变。
- **持久用户资料**：用户身份由 HttpOnly identity cookie 识别，昵称和头像持久化到数据库。
- **账号 ID + 密码找回**：用户可为当前账号首次设置密码，并保存账号 ID；换浏览器或丢失 cookie 后可用账号 ID + 密码找回同一身份。已设置密码后暂不支持重置或修改，因为服务端无法可靠确认操作者就是账号本人。
- **头像压缩**：头像支持 PNG/JPEG/WebP 上传，最大 5MB；服务端统一裁剪压缩为 256x256 WebP，前端无头像时生成默认渐变头像。
- **听歌统计**：歌曲开始播放时记录房间、歌曲信息和当时在线用户快照，为后续年度总结等功能保留数据。
- **同步播放与聊天**：Socket.IO 实时同步播放状态、队列、投票、聊天和房间成员状态。
- **多音源与 VIP Cookie 池**：支持网易云、QQ 音乐、酷狗搜索/播放；平台 Cookie 用于 VIP 播放共享和私有歌单读取。

## 技术栈

- 前端：React 19、Vite 7、TypeScript、Tailwind CSS v4、shadcn/ui、Zustand
- 后端：Node.js、Express 4、Socket.IO 4、SQLite (`better-sqlite3`)、Sharp
- Monorepo：pnpm workspaces，包含 `packages/client`、`packages/server`、`packages/shared`

## 本地开发

```bash
git clone https://github.com/Madokamaes/music-together.git
cd music-together
corepack enable
corepack pnpm install
corepack pnpm dev
```

本地默认端口：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

如果当前 shell 找不到裸 `pnpm`，可以直接使用 `corepack pnpm` 执行命令。

## 常用验证命令

```bash
corepack pnpm --dir "D:/music-together/packages/shared" exec tsc -p tsconfig.build.json --noEmit
corepack pnpm --dir "D:/music-together/packages/server" exec tsc --noEmit
corepack pnpm --dir "D:/music-together" --filter @music-together/client run typecheck
```

分包构建：

```bash
corepack pnpm --dir "D:/music-together" --filter @music-together/shared run build
corepack pnpm --dir "D:/music-together" --filter @music-together/server run build
corepack pnpm --dir "D:/music-together" --filter @music-together/client run build
```

## 部署

当前部署目标是单镜像 Node.js 服务：Express 同时提供 REST API、Socket.IO 和前端 SPA 静态文件。

```bash
docker run -d --name music-together --restart unless-stopped \
  -p 3001:3001 \
  -v music-together-data:/app/data \
  -e IDENTITY_SECRET='replace-with-a-stable-secret' \
  ghcr.io/madokamaes/music-together:latest
```

必须挂载 `/app/data`，否则容器重建会丢失 SQLite 数据库和头像文件。生产环境必须固定 `IDENTITY_SECRET`；更换它会让已有用户 cookie 失效。

默认情况下前端按当前页面 origin 连接后端，服务端 CORS 处于自动模式。需要显式白名单时再配置 `CLIENT_URL`。

## 数据持久化

默认持久化路径：

- `DATA_DIR=/app/data`
- `DATABASE_PATH=/app/data/music-together.sqlite`
- `AVATAR_DIR=/app/data/avatars`

SQLite 保存房间、成员、聊天、用户资料、账号密码哈希和听歌统计；头像文件保存在 `AVATAR_DIR`。

## 文档

详细架构文档见：

- [项目速查手册](docs/PROJECT_ARCHITECTURE.md)
- [数据流与 API](docs/architecture/data-flow.md)
- [部署说明](docs/architecture/deployment.md)

## 协议

[AGPL-3.0](LICENSE)
