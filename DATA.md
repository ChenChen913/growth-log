# 数据存储与备份机制说明

> 本文档是项目五份文档（README / DEPLOY / OPS / DATA / LESSONS）之一，与「数据总览页 → 云端数据说明」弹窗内容同源。
>
> 内容基于当前 `js/store.js` 与 `functions/api/` 的真实实现整理。

## 〇、数据流向

```
记录操作
  → 本机 localStorage（glog_cache，断网也成功）
  → 约 1.6~2 秒防抖
  → POST /api/sync_save
  → Cloudflare Pages Functions（校验口令哈希）
  → Cloudflare Workers KV（key: payload）
  → 徽标显示「已同步 HH:MM」
```

数据通常存在四个副本：

| 副本 | 位置 | 作用 |
|------|------|------|
| ① 本地缓存 | 每台设备 localStorage（`glog_cache`） | 秒级保存、离线可用 |
| ② 云端主库 | Cloudflare Workers KV（`payload`） | 跨设备共享、长期保存 |
| ③ 手动备份 | 导出的 JSON 文件（电脑 / 网盘） | 终极兜底 |
| ④ 站点内置备份 | `backups/latest-cloud.json` | 云端故障且新设备无缓存时自动展示 |

## 一、正常记录流程

1. 录入时先写本机 localStorage，标记 `dirty`；断网也会成功。
2. 防抖后把整包数据（文章 + 周报 + 头像 + 墓碑 + 时间戳）POST 到 `/api/sync_save`。
3. Functions 校验 `passcode_hash` 后写入 KV 的 `payload` 键；口令明文不落库。
4. 登录设备启动时拉取 KV 整包，云端是唯一事实标准。

## 二、Cloudflare 异常时

- **断网 / 切后台**：数据留在本机，联网后自动补传；v3.12 起降级状态每 30 秒重试。
- **Functions / KV 短暂不可用**：页面显示「离线浏览中」或「备份模式」；有缓存用缓存，新设备加载内置备份；恢复后自动切回实时同步。
- **Cloudflare 免费额度不会因闲置自动暂停**，不需要保活。
- **项目被误删 / 配置损坏**：用老设备本地缓存、JSON 备份或 `latest-cloud.json` 恢复；重建 Pages 项目 + KV 后按 [DEPLOY.md](DEPLOY.md) 配置。

## 三、多设备合并

- 每条记录带毫秒级 `_ts`，合并时本机刚编辑的优先；
- 删除写入 tombstones（最多 300 条），防止已删除记录复活；
- 导入旧备份同样按墓碑过滤（v3.12）；
- 整包推送 + 防抖，云端任意时刻都是完整整包。

## 四、备份与恢复

| 项目 | 说明 |
|------|------|
| 导出入口 | 数据总览 → 数据管理 →「导出数据（JSON 备份）」或「导出云端全量数据」 |
| 格式 | 包含 articles / weeks / avatar / tombstones；均可通过「导入历史数据」合并恢复 |
| 建议频率 | 每季度一次；批量录入后加做一次 |
| 存放 | 电脑本地 + 网盘各一份；GitHub Actions 每天自动同步一份到 `backups/latest-cloud.json` |

> ⚠️ 内置备份 `backups/latest-cloud.json` 随站点公开部署，仓库公开时其中的文章标题 / 阅读量 / 周报备注也可被直接下载；口令只保护 KV 实时数据。

> 📌 2026-10-26：旧云端项目不可达期间，`latest-cloud.json` 由本地新数据与旧云端备份恢复合并生成，保留阅读量 / AI 标记 / 墓碑，并加入 2 篇新文章、2 条周报；它不是云端直导快照。

## 五、Cloudflare 巡检

| 频率 | 动作 | 说明 |
|------|------|------|
| 平时 | 什么都不用做 | 徽标「已同步」即正常 |
| 每季度 | 导出云端全量备份 | 也可在 Cloudflare KV 控制台查看 `payload` |
| 仅异常时 | 检查 Pages / Functions / KV | Cloudflare Dashboard → Workers & Pages |

免费额度：Pages 静态托管免费；Functions 每天约 10 万请求；KV 每天 10 万读取、1000 写入。当前单用户、整包 36KB 的用量远低于上限。

## 六、常见问题

**Q1：换新设备，数据怎么过来？**
打开网站 → 输入口令 → 自动拉取 KV 全量数据。

**Q2：清浏览器缓存会丢吗？**
只丢本地缓存；云端 KV 不受影响，重新输口令即可拉回。

**Q3：无痕模式记录的数据呢？**
关闭即丢，重要记录勿在无痕模式操作。

**Q4：两台设备同时记录会冲突吗？**
按 `_ts` 合并，删除有墓碑保护，无需人工干预。

**Q5：数据量大了会卡吗？**
当前 89 篇文章 + 33 条周报约 36KB；KV 单 value 上限 25MB，余量很大。
