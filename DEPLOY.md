# 部署指南：Cloudflare Pages + Functions + KV

本项目是纯静态网站，无需构建；后端由 Cloudflare Pages Functions + Workers KV 提供，不再使用 Supabase。

## 架构

```
浏览器
  → Cloudflare Pages（静态文件）
  → /api/sync_get、/api/sync_save（Pages Functions）
  → Workers KV（payload / passcode_hash）
```

## 首次部署

1. 登录 Cloudflare Dashboard → Workers & Pages → 创建 Pages 项目（Direct Upload）。
2. 创建 KV namespace（例如 `growth-log-data`），记下 Namespace ID。
3. 修改 `wrangler.toml` 的 KV `id`；修改 `js/config.js` 的 `DATA_API_URL` 为 `https://<你的 Pages 域名>/api`。
4. 生成口令的 SHA-256 哈希，写入 KV 的 `passcode_hash` 键；不要把口令明文提交到仓库。
5. 部署：
   ```bash
   npx wrangler@4 login
   npx wrangler@4 pages deploy . --project-name growth-log-913 --branch main
   ```
6. 初始化数据：登录网站后用「导入历史数据」选择备份 JSON，或在 KV 的 `payload` 写入整包 JSON。

## 更新

1. 修改代码 / 内容；
2. 改了应用代码必须 bump `sw.js` 里的 `CACHE`；
3. 重新部署：
   ```bash
   npx wrangler@4 pages deploy . --project-name growth-log-913 --branch main
   ```

> 本地临时目录（如 `new/`）不要一起上传。

## 本地预览

```bash
npx wrangler@4 pages dev .
# 或纯静态预览
python -m http.server 8080
```

## GitHub Pages 镜像（可选）

GitHub Pages 只托管静态前端，数据 API 仍指向 Cloudflare；两处使用同一份 `js/config.js`。更新 GitHub 后 Pages 自动构建；Cloudflare 侧需单独重新 deploy。

## 自动快照（GitHub Actions）

仓库已包含 `.github/workflows/cloudflare-backup.yml`：

- 每天 UTC 02:17 自动从 Cloudflare API 拉取 `payload`，写入 `backups/latest-cloud.json`；
- 只有数据变化才 commit；
- 也可在 GitHub 仓库 → Actions → 「Cloudflare 数据快照」→ Run workflow 手动执行。

需要的 GitHub Secret：`GLOG_PASSCODE`（访问口令）。它只用于该定时任务，不会出现在代码/日志中。Cloudflare 不可达时任务会失败并保留旧快照，不会把备份写空。

## 数据迁移

从旧 Supabase 环境迁移：先在旧站导出云端全量数据（或使用 `backups/latest-cloud.json`），再到新站「导入历史数据」；导入会按墓碑过滤。`sql/setup.sql` 已废弃，仅历史参考。
