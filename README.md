# 公众号成长日志

私人公众号运营日志：记录文章与周度数据，自动生成趋势图表和月度 / 年度汇总。支持多设备云端实时同步，可安装到手机桌面作为 App 使用。

**线上访问（Cloudflare）**：https://growth-log-913.pages.dev/

**GitHub Pages 镜像**：https://chenchen913.github.io/growth-log/

## 功能

- 数据总览：累计阅读 / 分享统计、内容类型分布、AI 辅助创作占比
- 文章记录：增删改查、类型筛选、原创与 AI 标记、标题搜索 + 日期筛选 + 排序
- 周报告：阅读 / 分享 / 粉丝 / 7 类阅读来源占比（支持一位小数）、趋势折线图
- 月度年度：年份切换、月度趋势对比、12 个月度卡片含环比
- 云同步：Cloudflare Pages Functions + Workers KV，访问口令保护，多端实时同步，断网自动补传、降级后自动重试
- 数据安全：口令以 SHA-256 哈希存放在 KV；支持 JSON 导出 / 导入；故障预案见 [OPS.md](OPS.md)

## 技术栈

- **纯静态前端**：原生 HTML / CSS / JavaScript，零框架、零构建步骤
- **前端托管**：Cloudflare Pages（GitHub Pages 可作镜像）
- **后端**：Cloudflare Pages Functions + Workers KV（同站点 `/api`，不再使用 Supabase）
- **图表**：Chart.js（已本地化至 `vendor/`，页面无外链）
- **PWA**：Service Worker 离线缓存 + manifest，可安装到手机桌面
- **安全**：口令 SHA-256 哈希、渲染层 XSS 转义、导入数据字段级清洗

## 仓库结构

```
index.html            入口页（应用主体）
guides.html           公众号运营指导长页（6 位作者 18 篇方法论）
js/config.js          配置云端 API 地址（DATA_API_URL）
js/store.js           数据层（本地/云端双模式、合并、墓碑、重试、兜底）
js/app.js / card.js   主逻辑与数据卡片
js/monthly.js         月度/年度汇总
js/ux.js              交互增强
functions/api/        Pages Functions：sync_get / sync_save / health
wrangler.toml         Pages Functions 的 KV 绑定配置
css/style.css         全部样式
vendor/               Chart.js 本地副本
backups/              备份快照 + 内置兜底数据
sw.js                 Service Worker（改代码需 bump 缓存版本）
sql/                  旧 Supabase 脚本（v3.13 起已废弃，仅历史参考）
README / DEPLOY / OPS / DATA / LESSONS  五份文档
```

## 数据与隐私

- 数据整包存放在你自己的 Cloudflare Workers KV 中，访问必须输入口令；KV 只保存口令的 SHA-256 哈希
- `js/config.js` 中的 API 地址是公开信息，前端不含密钥
- 随时可用「导出数据（JSON 备份）」下载全部数据；导入时做字段级清洗
- ⚠️ 为支持断云兜底，`backups/latest-cloud.json` 会随站点公开部署；仓库公开时，快照中的文章标题 / 阅读量 / 周报备注也可被直接下载。敏感数据请使用私有仓库，或移除内置备份

## 备用站与每日备份

- **主站**：Cloudflare Pages（数据在 Cloudflare KV）
- **备用站**：GitHub Pages（同一份前端 + 同一 Cloudflare API）
- 每天由 GitHub Actions 自动从 Cloudflare KV 拉取快照，更新 `backups/latest-cloud.json`；也可以手动到 GitHub Actions 里运行「Cloudflare 数据快照」
- Cloudflare 故障时：打开备用站，能看本地缓存 / 最近快照；新改动先存本地，Cloudflare 恢复后再同步
- 自动快照工作流：`.github/workflows/cloudflare-backup.yml`

## 部署更新

```bash
npx wrangler@4 pages deploy . --project-name growth-log-913 --branch main
```

详见 [DEPLOY.md](DEPLOY.md)。

## 版本

- v3.13：后端从 Supabase 迁到 Cloudflare Pages Functions + Workers KV；移除 Supabase 依赖与保活链接；合并数据管理里的重复导出按钮
- v3.12：同步可靠性加固（降级自动重试 / 导入备份按墓碑过滤 / 口令哈希成本 12）
- v3.11：修复手机端 header 横向溢出
- v3.10：断云自动兜底（内置 GitHub 备份）
- v3.9：云端全量导出
- v3.8：统计洞察（周维度 8 卡 / 单篇 TOP10 / 快速补录）
- v3.7：运营指导页全量审计补全 45 处
- v3.6：运营指导页改为当前页跳转
- v3.5：运营指导页图片全部转文字
- v3.4：运营指导页上线（6 位作者 18 篇）
- v3.3：缓存优先秒显、离线降级不弹口令门
- v3.2.2：Service Worker 加固（404 不污染缓存）
- v3.2：周报占比支持一位小数、周报删除、移动端适配、安全加固
- v3.1：本地模式引导卡、14 天备份提醒
- v3.0：云同步、口令保护、月度汇总、PWA、资源本地化
- v2.0：单文件本地版
