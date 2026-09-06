# 公众号成长日志

私人公众号运营日志：记录文章与周度数据，自动生成趋势图表和月度 / 年度汇总。支持多设备云端实时同步，可安装到手机桌面作为 App 使用。

**线上访问**：https://chenchen913.github.io/growth-log/

## 功能

- 数据总览：累计阅读 / 分享统计、内容类型分布、AI 辅助创作占比
- 文章记录：增删改查、类型筛选、原创与 AI 标记、标题搜索 + 日期筛选 + 排序
- 周报告：阅读 / 分享 / 粉丝 / 7 类阅读来源占比（支持一位小数）、趋势折线图
- 月度年度：年份切换、月度趋势对比、12 个月度卡片含环比
- 云同步：Supabase 免费云数据库 + 访问口令保护，多端实时同步，断网自动补传
- 数据安全：故障预案与巡检频率见 [OPS.md](OPS.md)；部署步骤见 [DEPLOY.md](DEPLOY.md)

## 技术栈

- **纯静态前端**：原生 HTML / CSS / JavaScript，零框架、零构建步骤，克隆即用，无需安装任何 npm 依赖
- **图表**：Chart.js（已本地化至 `vendor/`，页面无任何被墙外链）
- **云存储**：Supabase（PostgreSQL + RPC + RLS 行级安全），免费版即可运行
- **PWA**：Service Worker 离线缓存 + manifest，可安装到手机桌面全屏使用
- **安全**：口令 bcrypt 哈希校验、数据库 RLS 锁表、渲染层 XSS 转义、导入数据字段级清洗
- 数据存储与备份机制详解见 [DATA.md](DATA.md)

## 仓库结构

```
index.html            入口页（应用主体）
js/config.js          唯一需要修改的配置文件（Supabase 地址与密钥）
js/store.js           数据层（本地/云端双模式、合并、墓碑、离线补传）
js/app.js / card.js   主逻辑与数据卡片
js/monthly.js         月度/年度汇总
js/ux.js              交互增强
css/style.css         全部样式（含移动端自适应）
vendor/               Chart.js 本地副本
sql/setup.sql         Supabase 建库脚本（一次性执行）
sw.js                 Service Worker（更新代码时需 bump 缓存版本号）
icons/                应用图标
manifest.webmanifest  PWA 清单
README/DEPLOY/OPS/DATA  四份文档
```

## 部署

```bash
# 1. Supabase 创建项目，SQL Editor 执行 sql/setup.sql
# 2. 把 Project URL 和 anon key 填入 js/config.js
# 3. 推送到 GitHub，Settings → Pages 开启（main 分支 / root）
```

不配置 Supabase 也可以直接使用——应用以本地模式运行（数据仅存当前设备），之后随时填入配置升级为云同步。

## 数据与隐私

- 数据整包存储在你自己的 Supabase 项目中，访问需口令，数据库已启用 RLS 锁死
- 口令以 bcrypt 哈希保存，明文不落库；`js/config.js` 中的 anon key 是设计上的公开密钥
- 随时可用「导出 JSON 备份」下载全部数据；导入时字段级清洗，防恶意数据注入
- 数据流向、离线机制、备份恢复的完整说明见 [DATA.md](DATA.md)，运维与故障预案见 [OPS.md](OPS.md)

## 版本

- v3.2.2：Service Worker 加固——网络响应非 200 时回退缓存，站点 404 页面永远不会污染本地离线缓存
- v3.2.1：微信官方图标替换与缓存版本升级
- v3.2：周报占比支持一位小数、周报删除功能、移动端顶部导航与图表自适应修复、微信官方图标、安全加固（XSS 防御 + 导入数据清洗）
- v3.1：本地模式引导卡、14 天备份提醒
- v3.0：云同步、口令保护、月度汇总、移动端适配、PWA、资源本地化
- v2.0：单文件本地版
