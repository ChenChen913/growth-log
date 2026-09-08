# LESSONS · 开发踩坑手册与协作经验（内部文档）

> 这份文档不是产品说明书。README 讲「怎么用」，这份讲「我们踩过什么坑、为什么这么设计、下次怎么避」。
> 它是项目从 v1 单文件演进到 v3.11 的全部实战经验沉淀，写给未来的维护者（包括人类和 AI 助手）。
> **安全约定：本文件不含访问口令、GitHub token、Supabase 密钥。涉及凭据处一律以「见 config.js」「用户私有」代替。**

---

## 目录

1. [项目架构速览](#一项目架构速览)
2. [铁律清单（每次改动必读）](#二铁律清单每次改动必读)
3. [踩坑记录 A · Service Worker 与缓存](#三踩坑记录-a--service-worker-与缓存)
4. [踩坑记录 B · 移动端自适应](#四踩坑记录-b--移动端自适应)
5. [踩坑记录 C · 浏览器自动化测试](#五踩坑记录-c--浏览器自动化测试agent-browser)
6. [踩坑记录 D · Git 与 GitHub Pages 部署](#六踩坑记录-d--git-与-github-pages-部署)
7. [踩坑记录 E · Supabase 后端](#七踩坑记录-e--supabase-后端)
8. [踩坑记录 F · 数据安全与完整性](#八踩坑记录-f--数据安全与完整性)
9. [标准作业流程 SOP](#九标准作业流程-sop)
10. [测试方法论](#十测试方法论)
11. [与用户协作的经验](#十一与用户协作的经验)
12. [版本演进时间线](#十二版本演进时间线)
13. [本文档的维护约定](#十三本文档的维护约定)

---

## 一、项目架构速览

理解架构是理解后面所有坑的前提。

### 1.1 技术形态

纯静态 SPA（无框架、无构建步骤）：`index.html + css/style.css + js/*.js`，部署在 GitHub Pages。数据双模式：

- **本地模式**：数据存 localStorage（`glog_cache`），开箱即用
- **云端模式**：Supabase 两个 RPC（`sync_get` / `sync_save`）+ bcrypt 口令校验 + RLS 锁表；整包读写、按 `_ts` 时间戳合并、墓碑（tombstones）防删除记录复活

### 1.2 数据流向（云端模式）

```
UI 操作 → 内存 state → localStorage(glog_cache, 含 dirty 标记) → 防抖推送 → Supabase 整包
                                                        ↘ 断网时暂存，online/visibilitychange 自动补传
启动时：localStorage 缓存优先秒显 → 云端 pull → 内容指纹(renderedKey)比对 → 有变化才重绘
云端不可达兜底：fetch('./backups/latest-cloud.json')（GitHub 内置备份）→ 只读展示
```

### 1.3 数据四层保险（v3.10 闭环）

| 层级 | 载体 | 恢复速度 | 说明 |
|------|------|---------|------|
| 1 | 本机 localStorage 缓存 | 即时 | 断网可离线浏览，恢复后自动补传 |
| 2 | Supabase 云端权威数据 | 秒级 | 换设备输口令即拉全量 |
| 3 | GitHub 内置备份 `backups/latest-cloud.json` | 自动 | 随 Pages 部署，断云+新设备时自动兜底展示 |
| 4 | 用户手动导出的 JSON 文件 | 手动导入 | 终极保险，跨设备合并恢复 |

### 1.4 关键文件职责

| 文件 | 职责 | 改动注意 |
|------|------|---------|
| `js/config.js` | 唯一配置文件（Supabase URL + key） | SW 对它**网络优先**，改它不用 bump 缓存版本 |
| `js/store.js` | 数据层：双模式、清洗白名单、合并、墓碑、兜底 | 涉及数据结构，改动必须全链路回归 |
| `js/app.js` | UI 层：渲染、CRUD、弹窗、导出 | 渲染拼接必须走 `esc()` |
| `sw.js` | 缓存策略核心 | 改任何应用文件都要 bump 第一屏的 `CACHE` |
| `backups/latest-cloud.json` | 内置备份兜底数据 | 由 `scripts/backup_push.py` 自动同步更新 |
| `sql/setup.sql` | Supabase 一次性建库脚本 | 含 bcrypt 哈希，属敏感操作文件 |
| `scripts/package_v35.py` | 部署包打包 + 断言 | 每个版本必须升级断言点 |

---

## 二、铁律清单（每次改动必读）

这些是用真实事故换来的规则，**违反任何一条都会产生线上事故或返工**。

### 铁律 1：改任何应用代码，必须 bump sw.js 的 CACHE 常量

`sw.js` 第一屏 `const CACHE = 'glog-v3.11.flexfix'`。静态资源走**缓存优先**策略——不改这个字符串，老设备永远拿不到新代码，且你自己本地测试都会被旧缓存骗（详见坑 A-1）。

命名惯例：`glog-v{主版本}.{语义短名}`，如 `v3.8.insights`、`v3.9.cloudexport`、`v3.10.bkfall`、`v3.11.flexfix`。一个功能一个名字，方便在 DevTools Application 面板里一眼认出线上跑的是哪个版本。

**例外**（不用 bump）：只改 `config.js`（SW 对它网络优先）、只改 `.md` 文档（不在 CORE 清单，不影响应用）。

### 铁律 2：推送必须走 repo-sync/gl 克隆管线

工作区 `/home/z/my-project/download/growth-log/` **没有 .git**（它是部署包的源），不能直接推。正确路径：

```
改 download/growth-log/ → cp 改动文件到 /home/z/my-project/repo-sync/gl/ → cd repo-sync/gl
→ git pull → git add <明确列出的文件> → commit → push → POST /pages 触发构建 → builds/latest 确认
```

不要用 GitHub API 逐文件提交（容易漏二进制、无法原子回滚），不要在 download 目录临时 git init（会污染部署包，见坑 D-3）。

### 铁律 3：敏感信息绝不入仓、不入文档、不入对话产物

- 访问口令只存在于：Supabase 数据库（bcrypt 哈希）、用户手机记忆。**任何脚本、文档、SQL、截图里都不出现明文**
- GitHub token 只在内存/curl header 里用，绝不写进文件；`git remote` 用完即删
- 每次打包/推送前跑敏感扫描（七类字符串，见 F-4），打包断言里固化

### 铁律 4：备份文件只进 repo-sync/gl，不进 download 工作副本

`download/growth-log/` 是部署包的源。备份 JSON 混进去会被打进 zip，交付物被污染。（例外：`backups/latest-cloud.json` 是站点内置兜底数据，**有意**放在 download 里随站点部署，由脚本自动同步——这是功能，不是污染。）

### 铁律 5：每个版本升级打包断言脚本

`scripts/package_v35.py` 从 v3.5 沿用至今，每个版本追加新功能的「关键点断言」（sw 版本、新函数名、新 CSS 类、敏感信息零出现）。这是部署包的验收测试——写代码时觉得自己不会忘，真到打包时就会漏。

### 铁律 6：上线不算完成，线上实机验证 + 截图存档才算

推送 → Pages built → **线上实际打开过口令门 → 触发新功能 → 断言数据 → 截图存 download/**。本地测试全绿但线上白屏的事，靠这一步兜住（案例：Pages CDN 边缘缓存延迟，文件 200 但内容还是旧的）。

### 铁律 7：测试数据必须清零，云端账目必须对上

测试产生的文章/周报必须删除，并通过 `sync_get` 直查云端确认零残留；墓碑数量要能对账（基线 + 本次删除数）。用户的数据是真实公众号运营记录，一个测试行留在统计里就是事故。

---

## 三、踩坑记录 A · Service Worker 与缓存

### A-1 缓存优先策略吃掉所有更新（铁律 1 的来源）

- **现象**：代码明明推上去了，线上页面行为还是旧的；本地测试也复现不了新逻辑
- **根因**：v1 设计静态资源「缓存优先」，SW 安装时把 CORE 清单全部缓存，之后 fetch 一律先查缓存命中即返回——不换 CACHE 名，浏览器连新 sw.js 的差异检测都不会触发完整更新周期
- **解法**：内容/版本化缓存名。改动代码 → bump `CACHE` → 老设备在下一次导航时自动完成「检测新 sw.js → install 新缓存 → activate 删旧缓存 → controllerchange 自动刷新」
- **验证**：DevTools → Application → Service Workers / Cache Storage，确认唯一缓存名 = 新版本

### A-2 SW 更新有周期，测试时要主动触发「装甲」

- **现象**：新版上线后，设备要访问两次才拿到新逻辑；只 reload 一次还是旧的
- **根因**：SW 更新周期是「导航 → 后台检查 sw.js → install → 等旧 SW 控制的页面全部关闭 → activate」。第一次访问只是触发检查，第二次（或 controllerchange 自动刷新后）才由新 SW 接管
- **解法**：测试时连续 reload 两次（间隔 2 秒以上给 install 留时间）；正式场景靠 `controllerchange` 监听自动刷新，用户无感
- **衍生概念**：「装甲设备」= 已完成新 SW 接管的设备。转私有下线实验（v3.2.2）时，只有装甲设备能离线继续用

### A-3 SW 把 404 页面当成功缓存（缓存污染，最危险的一坑）

- **现象**：仓库转私有期间站点 404，部分设备访问后，**连恢复上线后都打不开**——缓存里存的是 GitHub 404 页 HTML
- **根因**：sw.js 导航/config.js 分支是「网络优先」，但代码只写了 `fetch(...).then(res => caches.put(...))`，**没检查 `res.ok`**。404 响应也是合法 fetch 成功，于是 404 页面被 put 进缓存覆盖了 `./index.html`
- **解法**：所有网络优先分支必须加 `!res.ok` 守卫——非 200 直接回退缓存，永不把非 200 写盘
- **教训**：「网络优先」和「缓存优先」一样需要防御性写法。任何写缓存的路径都要问一句：这个响应可能是什么垃圾？

### A-4 GitHub Pages CDN 对文件有边缘缓存

- **现象**：push 后立刻 curl，GitHub raw/API 已是新版，但线上 URL 拿到的还是旧内容
- **根因**：Pages 的 Fastly CDN 对资源有约 **10 分钟边缘缓存**（带 `cache-control: max-age=600`）
- **解法**：验证时用 `fetch(url, {cache: 'reload'})` 或加随机 query 绕边缘缓存确认源站；给用户的口径是「≤10 分钟自动生效」。`config.js` 因此被 SW 设计为网络优先——改配置最多延迟 10 分钟，可接受

### A-5 测试环境 http.server 的启发式缓存（踩了两次！）

- **现象**：本地 http.server 测试，明明改了 `store.js`，浏览器 fetch 到的还是旧文件；`caches` 里已经是新版也没用
- **根因**：`python3 -m http.server` **不发 Cache-Control 头**，浏览器按 RFC 启发式给无缓存头的资源估算新鲜度（约 Last-Modified 时长的 10%），直接从 HTTP 缓存供应，请求根本不出门。Task 20 踩过一次，Task 21 又踩——已写进本文档防止第三次
- **解法**：**换端口 = 换 origin = 换全部缓存**。测试基础设施约定：每轮大测试用新端口（8471 → 8472 → …）。线上 Pages 有正确缓存头 + SW 网络优先，无此问题
- **辨析**：SW 缓存（Application 面板可查）和 HTTP 缓存（Network 面板 size 列显示 disk cache）是两层，排障时分别确认

### A-6 备份文件需要独立的缓存策略

- **现象**（设计期推演）：`backups/latest-cloud.json` 若走「缓存优先」，用户备份更新后，设备可能永远展示旧备份快照
- **解法**：sw.js 为 `backups/latest-*` 单独写「网络优先、失败回缓存」策略。教训：**同一站点内不同资源的更新诉求可能完全相反**（应用代码要稳定、数据文件要新鲜），缓存策略要按资源语义分层，不能一刀切

---

## 四、踩坑记录 B · 移动端自适应

### B-1 flex 子项 min-width:auto 是横向溢出第一大根源（三次同类事故）

- **事故史**：
  1. v3.2：总览页 chart-card 在 724px 视口撑破容器——grid 子项 `min-width:auto` + Chart.js canvas 定宽，内容拒绝收缩
  2. v3.8：文章表 7 列栅格，中列文本长导致行溢出（≤640px 隐藏中列缓解）
  3. v3.11：手机 header「记录文章」按钮被裁 10~45px——`.logo`（nowrap 标题）+ `.sync-badge`（nowrap 状态词）+ 按钮（nowrap）三者 min-content 之和超过容器
- **根因**：flex/grid 子项默认 `min-width:auto`，**收缩下限 = 内容最小宽度**。`white-space:nowrap` 的文本、定宽 canvas、长英文单词都会把 min-content 撑得巨大，flex 再怎么算也压不下去，只能溢出
- **解法**（三件套）：
  ```css
  .layout-cols > *, .chart-card, .chart-wrap { min-width: 0; max-width: 100%; }
  canvas { max-width: 100%; }
  /* header 场景：全链路放开 + 明确收缩优先级 */
  .logo, .logo-text, .header-actions { min-width: 0; }
  .sync-badge { min-width: 0; flex-shrink: 1; }   /* 优先收缩 ellipsis */
  .header-actions .btn { flex-shrink: 0; }          /* 核心操作永不裁切 */
  ```
- **方法论**：让「谁可以被牺牲」显式化——次要信息（状态词时间、标题尾字）配 `overflow:hidden + text-overflow:ellipsis`，核心操作（按钮）配 `flex-shrink:0`

### B-2 只在 body 上设 overflow-x:hidden 挡不住移动端滑动

- **现象**：body 明明有 `overflow-x: hidden`，手机上页面还是能左右拖动（v3.11 用户报障的直接机理）
- **根因**：移动端浏览器（iOS Safari 为甚）对 body 单独设 hidden 的处理不可靠——html 层仍可滚动
- **解法**：**html 和 body 双层都设** `overflow-x: hidden`。这是「能滑动」和「内容被裁」两种表象共同的底层修复
- **注意**：这招是兜底不是治病。先把溢出元素找出来修掉（B-1），hidden 只防未来的意外

### B-3 横向溢出的标准排查法（可复用脚本）

肉眼猜哪个元素溢出效率极低，直接全量扫描（agent-browser eval 执行）：

```js
(() => {
  const vw = document.documentElement.clientWidth;
  const off = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('.bg-orbs')) return;              // 排除故意越界的装饰
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5))
      off.push(el.tagName + '.' + el.className + ' R' + Math.round(r.right));
  });
  return JSON.stringify({vw, htmlSW: document.documentElement.scrollWidth,
                         bodySW: document.body.scrollWidth, n: off.length, off: off.slice(0, 8)});
})()
```

判读要点：`htmlScrollW > vw` = 页面可滑动（用户可感知事故）；元素越界但在 `overflow-x:auto` 容器内部 = 容器内滑动（设计行为，如极窄屏 tab 栏）。验收标准：**320/360/375/390/430 五档视口 + 全部 tab + 全部弹窗，htmlScrollW === vw 且 n === 0**。

### B-4 媒体查询要平铺，不要嵌套

- **现象**：tab 栏极窄屏回退规则写在另一个 @media 块内嵌套时，部分老内核不识别
- **解法**：所有 @media 平铺在文件层级。CSS 标准虽允许条件组规则嵌套，但兼容性优先，一律平铺 + 注释互相引用（「见文件末尾媒体查询」）

### B-5 移动端输入框 16px 防 iOS 聚焦缩放

iOS Safari 对 font-size < 16px 的输入框，聚焦时会自动放大页面且不回弹。所有 `form-input/form-textarea/form-select` 在 820px 断点统一 `font-size: 16px`。

### B-6 安全区（safe-area-inset）三处必设

全面屏手机：① 弹窗改底部抽屉后 `padding-bottom: calc(22px + env(safe-area-inset-bottom))`；② toast 容器同理；③ `viewport meta` 必须带 `viewport-fit=cover`（否则 env() 恒为 0）。

### B-7 图标/图片首帧闪烁（FOUC）组合拳

- **根因**：header 入场动画（opacity/transform）+ backdrop-filter 在部分移动内核（X5 类）产生瞬态合成伪影；img 无宽高属性时首帧 0 尺寸再回流跳变
- **解法**：img 一律带 `width/height` 属性；移除 header 容器入场动画；`<link rel="preload" as="image">` 提前拉关键图；大体积 JS（Chart.js 200KB）从 head 挪到 body 尾部

### B-8 「一小块遮挡」类用户报障的定位心得

用户描述是「按钮有一小块遮挡、能左右滑动」。不要在 390px 视口复测（iPhone 主流宽度余量够，复现不了）——**用 360px（安卓主流）和 320px（极窄）测**。本次 390px 完全正常、360px 溢出 10px、320px 溢出 45px，与「一小块」描述精确吻合。不同厂商字体宽度差异（PingFang/MiSans/HarmonyOS Sans）会让临界布局时好时坏，修复目标必须是「结构性零溢出」而不是「我这里刚好放得下」。

---

## 五、踩坑记录 C · 浏览器自动化测试（agent-browser）

### C-1 find text 定位不可靠，优先 snapshot refs 或 eval

`find text "xxx" click` 对动态渲染、重名文本（如「记录文章」按钮出现在 header 和弹窗两处）会点错或点不中。可靠顺序：`snapshot -i` 拿 `@e` refs → `click @eN`；DOM 事件类操作直接 `eval "fnName(); 'ok'"`。refs 在页面不重载的前提下是稳定的，弹窗/DOM 大变后要重新 snapshot。

### C-2 window 自定义变量跨 eval 丢失

agent-browser 每次 eval 是独立 world（类似浏览器扩展 content script），上一个 eval 挂的 `window.__x` 下一个 eval 读不到。**断言必须在单次 eval 内闭环**：一个 eval 里完成「取值 → 计算 → return JSON」。

### C-3 confirm/对话栏处理

删除记录会弹原生 confirm。流程：先 `dialog accept` 注册处理器（或点触发后立即 accept），点删除按钮，dialog 自动接住。若测试框架不支持预注册，用 `setTimeout(0)` 后触发点击的顺序技巧。

### C-4 沙箱 loopback 隔离

agent-browser 访问 `http://127.0.0.1:PORT` 可能 `ERR_CONNECTION_REFUSED`（沙箱网络命名空间隔离）。解法：服务器绑 `0.0.0.0`，浏览器用 `localhost:PORT` 访问。

### C-5 首访拦截层：引导卡与口令门

新 origin 首次打开会叠两层拦截：①本地模式首访引导卡（点「开始使用」关闭）；②云端模式口令门（`fill @e9 "<口令>"` + `click @e10`，或 fill 后 `press Enter`）。自动化测试开头先 snapshot 确认没有 overlay 挡着，否则所有点击都静默失败。

### C-6 Chart.js 动画期截图是数据假象

入场动画 800ms 内截图，柱子只有半截——不是 bug。验证图表数据用实例真值：`chartInstance.data.datasets[0].data`，截图只看布局不看数值。

### C-7 捕获 Blob 下载内容的方法

导出功能测试：eval 里装钩子再点按钮——

```js
const orig = URL.createObjectURL;
window.__blobText = null;
URL.createObjectURL = b => { b.text().then(t => window.__blobText = t); return orig(b); };
```

点击导出 → 下一个 eval 读 `window.__blobText` → `JSON.parse` 逐字段断言。注意 C-2：钩子安装和读结果必须是两次 eval 时，中间的点击动作不能换 page。

### C-8 网络拦截模拟断云

`network route "**supabase.co/**" --abort` 拦截 Supabase 全部请求模拟云断。**pattern 格式坑**：域名前是 `**/`（斜杠）不是 `**.`——写 `**.supabase.co/**` 匹配不到。测完 `network unroute` 恢复。配合「清 SW + 清 localStorage」可完整模拟全新设备断云场景。

### C-9 tab 切换用 t 标识

多标签页场景 `tab 1` 有时失效，用 `tab t1` 标识形式。新标签打开后（如 window.open 场景）先 `tab` 列表确认当前页再操作。

### C-10 控制台零报错是验收硬指标

每轮测试收尾必跑 `agent-browser errors` 和 `console`。唯一豁免：无害 favicon 404（若存在）。

---

## 六、踩坑记录 D · Git 与 GitHub Pages 部署

### D-1 部署目录与 git 仓库分离（双目录管线）

- download/growth-log：部署包源，**永远无 .git**（zip 断言检查）
- repo-sync/gl：持久克隆（remote 指向 chenchen913/growth-log，main 分支），承担全部 git 操作
- 每次推送 = cp 改动文件 → commit。`git status --short` 确认**只有预期文件**被改动（多余改动 = 上游被意外污染，先查明再推）

### D-2 core.fileMode 屏蔽权限位漂移

沙箱文件系统权限位与 GitHub 侧不一致，`git status` 会显示假改动。提交统一 `git -c core.fileMode=false commit ...`。

### D-3 .git 混入部署包事故

v3.2 时 download/growth-log 混入 .git 目录（50 文件），被压缩进交付 zip。虽然检查确认无 token 泄露，但从此打包脚本固化断言：`assert not any('.git' in parts)` + `.gitignore` 处理。**交付物完整性要靠断言，不靠人工记忆。**

### D-4 GitHub API 使用要点

- 所有请求必须带 `User-Agent` header，否则 403
- `builds/latest` 等 API 要带 `Authorization: token <TOKEN>`
- 触发构建 `POST /repos/<owner>/<repo>/pages` 返回 **409 = 构建已在进行，不是错误**；最终以 `GET /builds/latest` 的 `status: built + commit hash` 为准
- push 后轮询节奏：sleep 25~35 秒查一次，一般 10~30 秒 built

### D-5 免费账户私有仓库没有 Pages（硬限制）

- **实测**：`PATCH /repos {private: true}` 瞬间生效，但 GitHub Free 的私有仓 Pages **立即下线**（站点 404、Pages API disabled、has_pages 仍在但不出图）
- **恢复**：`PATCH private: false` → `POST /pages`（legacy，main/root）→ 分钟级 built。已在 v3.2.2 实测两次，承诺「随时上线分钟级恢复」的依据
- **决策记录**：用户选择保持 public（仓库已确认无敏感数据）。若未来要私有：GitHub Pro（$4/月）或迁 Cloudflare Pages（免费支持私有仓）
- **教训**：转私有这类不可逆倾向的操作，先查平台限制再动手；下线前先给设备「装甲」（完成 SW 更新周期，见 A-2）

### D-6 push 后验证三板斧

① `curl` 线上 URL 确认 200 且内容含新版本标记；② sw.js 内容确认 CACHE 新版本名；③ agent-browser 线上实机走一遍核心路径。raw 文件 URL 格式：`https://raw.githubusercontent.com/chenchen913/growth-log/main/<path>`。

---

## 七、踩坑记录 E · Supabase 后端

### E-1 pgcrypto 装在 extensions schema

- **现象**：用户跑完 setup.sql，口令登录报 `function crypt(text,text) does not exist`
- **根因**：Supabase 默认把 pgcrypto 扩展装在 `extensions` schema，而 RPC 函数 `SET search_path = public` 找不到 crypt
- **解法**：所有 RPC 的 search_path 写 `public, extensions`（Supabase 官方标准配置）。表和哈希数据不用重建，只需重建两个函数
- **教训**：给非技术用户写 SQL 脚本，要预设「在 Supabase 默认环境跑」而不是「在任意 Postgres 跑」

### E-2 免费版 7 天无活动休眠 + 保活方案

- Supabase 免费项目 7 天无 API 活动会休眠（数据保留，控制台 Restore 1-2 分钟复活）；约 90 天长期休眠有清理风险
- **保活**：log_data 表被 RLS revoke（直查 401，安全设计符合预期），但 **PostgREST 支持 GET 调 RPC + apikey query 参数**——`GET /rest/v1/rpc/sync_get?p_code=<口令>&apikey=<key>` 可做成只读保活收藏夹链接（1-2 周点一次）
- **安全注意**：该链接含口令明文，只存用户本地收藏夹，绝不入仓入档

### E-3 口令体系设计

- 口令明文**永不落库**：换口令时本地 bcrypt（$2a$12）预计算哈希，SQL 里只出现哈希——Supabase SQL 执行历史里也查不到明文
- 前端零改动换口令：口令只存数据库 app_config 表，改哈希即换口令，旧口令设备自动被 ACCESS_DENIED 登出（安全行为）
- 访问控制不可被兜底绕过：v3.10 备份兜底逻辑明确排除 ACCESS_DENIED——口令错误就是错误，不能因为「有备份」就放行

### E-4 数据导入导出的账目习惯

任何云端写操作前后 `sync_get` 直查核对：文章数、周报数、墓碑数、updatedAt。导入历史备份前先拉云端墓碑合并（防止把用户删过的记录复活）。脚本化（`scripts/import_backup.py`、`backup_cloud.py`）而非手工 curl，参数化域名口令避免笔误（Task 10 因脚本域名手写笔误 DNS 失败过一次）。

---

## 八、踩坑记录 F · 数据安全与完整性

### F-1 字段白名单清洗是 XSS 与原型污染的总闸

- **事故背景**：open-code-review 审计发现 6 处攻击面：esc() 未转义单引号、TYPE_MAP fallback 输出未转义、onclick 属性内 `${_ts}` 可被非数字 _ts 逃逸（6 处渲染点）、monthly.js 年份单引号逃逸链、importData 无字段清洗
- **总解法**：store.js `sanitizeArticle/sanitizeWeek` **白名单重建**——只保留已知字段、强制类型、数值限幅、非数字 _ts 整条丢弃、`__proto__` 等危险键直接不存在于新对象。云端 pull、本地读缓存、用户导入三条入口全部过 normalize
- **配套**：`esc()` 补单引号转义；onclick 内的变量一律 `Number()` 强制；攻击样本（img onerror/svg onload/属性逃逸/proto 污染/数值超限）实测全绿 + 真实数据零误伤
- **心法**：转义是「出口防御」，白名单是「入口防御」，两个都要；「信任边界」是用户输入、云端数据、历史缓存——凡是从 localStorage/网络来的都当不可信

### F-2 墓碑（tombstones）机制的三个细节

1. 删除记录不是真删，是 `_ts` 进墓碑数组，多端合并时据此拦截「旧数据复活」
2. 墓碑上限 300 条（防无限膨胀），FIFO 淘汰
3. 防御加固：`addTombstone` 必须 `!ts` 校验 + includes 去重（实测 undefined 能被写成 null 入数组）

### F-3 备份文件双口径约定（v3.9 起）

| 口径 | version | _meta.source | 识别要点 |
|------|---------|-------------|---------|
| 本机快照 | 3.0 | 无 | 老格式，可能不含 counts |
| 云端全量 | 3.1 | 'cloud' | 含 `counts: {articles, weeks, articlesWithReads}` |

`scripts/backup_push.py` 据此自动识别类型归档。字段白名单：`_ts, title, type, datetime, original, aiUsage, reads`。reads 为 null 表示未统计，不参与单篇统计。

### F-4 敏感扫描清单（推送/打包前必过）

七类字符串，任一命中即拒绝入库：访问口令明文、`ghp_` 前缀（GitHub token）、`sb_publishable_`（Supabase 新版 key）、`SUPABASE_URL`（连接串）、`apikey`、`ANON_KEY`、`password`。已固化在 backup_push.py 和 package_v35.py。**扫描的对象不仅是代码，还有数据文件本身**（用户导出的 JSON 理论上干净，但必须扫过才算干净）。

### F-5 幂等性：重复推送不产生垃圾 commit

backup_push.py 初版重复推送同日数据时 HISTORY.md 追加重复行 → 多余 commit。修复：先读 existing 行集，新行去重后再追加；复跑验证「数据与仓库完全一致，无需推送」分支。**任何「会反复执行」的脚本都要设计幂等**：先比对、再变更、无变化则零操作。

### F-6 数据体检清单（用户拿历史数据来时）

空标题、重复 `_ts`（主键冲突）、字段类型（reads 应为整数或 null）、日期范围合理性、墓碑保留、特殊字符标题（顺带过 sanitize 零误伤）。v2.0 → v3.0 迁移（Task 5，87 篇/29 周报）即按此清单执行零事故。

---

## 九、标准作业流程 SOP

### 9.1 代码改动上线管线（完整八步）

```
1. 改 download/growth-log/（代码+必要的 DATA.md/文案同步）
2. bump sw.js CACHE → 本地新端口起服务器 → agent-browser 全量验证（功能断言 + 溢出扫描 + 控制台）
3. python3 scripts/package_v35.py（断言全过 + 部署包更新）
4. cp 改动文件 → repo-sync/gl → git status 核对 → pull → commit（core.fileMode false）→ push
5. POST /pages 触发构建（409 忽略）→ sleep 30 → builds/latest 确认 built + commit 对
6. curl 线上三件套（index/sw/改动文件）确认新标记
7. agent-browser 线上实机：过口令门 → 真实数据加载 → 新功能触发 → 数据断言 → 截图存 download/
8. worklog.md 追加 Task 记录 → 向用户汇报（commit hash + 线上验证结论 + 截图路径）
```

### 9.2 备份推送管线（用户丢 JSON 过来时）

```
python3 /home/z/my-project/scripts/backup_push.py <备份.json> [更多.json]
```

自动完成：类型识别（cloud/local）→ 结构校验 + 七类敏感扫描 → backups/ 按日归档 + latest 双指针 → HISTORY.md 幂等索引 → git pull/commit/push → 同步 latest-cloud.json 到站点内置位置。人工只做一件事：向用户报 GitHub 上最新备份状态。

### 9.3 灾难恢复速查

| 场景 | 动作 | 耗时 |
|------|------|------|
| Supabase 断网/休眠 | 无需动作（四层保险自动兜底）；休眠则控制台 Restore | 1-2 分钟 |
| 站点误删/转私有后想恢复 | PATCH private:false → POST /pages → 验证 | 分钟级 |
| 全新部署 | 部署包 zip 解压 → 填 config.js → push → 开 Pages → 用户输口令拉云 | 15 分钟 |
| 数据误清 | Supabase 控制台查历史 / GitHub backups/ 按日归档 / 用户本地 JSON 三通道择一恢复 | 视情况 |

### 9.4 移动端验收清单

- [ ] 320/360/375/390/430 五档视口 htmlScrollW === clientWidth
- [ ] 全部 tab + 全部弹窗逐个打开后零溢出
- [ ] 输入框 font-size 16px、弹窗底部抽屉带 safe-area
- [ ] 触控目标 ≥ 44px
- [ ] 控制台零报错

---

## 十、测试方法论

### 10.1 分层验证金字塔

```
静态断言（打包脚本/全文 grep）     ← 秒级，每次提交
  ⊃ 本地浏览器全功能（agent-browser）  ← 每个功能改动
    ⊃ 线上实机 + 真实云端数据          ← 每次上线
      ⊃ 多设备/断网/断云场景模拟        ← 涉及同步/兜底逻辑时
```

### 10.2 本地测试环境约定

- 专用端口每轮更换（启发式缓存坑，见 A-5）；服务器 `(nohup python3 -m http.server PORT &)` 后台化防误杀
- 云端模式测试 = 直接用真实 config.js 连真云（口令门 → 真数据）；本地模式测试 = 临时移开 config.js（演示数据），**测完必须归位**
- 模拟新设备 = 清 SW（`caches.keys().then(ks => ks.forEach(k => caches.delete(k)))` + 注销 SW）+ 清 localStorage/sessionStorage
- 模拟断云 = network route abort（见 C-8）

### 10.3 云端零污染闭环

测试增改的数据必须删除，然后 `sync_get` 直查核对终态。**墓碑账目法**：终态墓碑数 = 基线墓碑数 + 本次删除数，多一个少一个都要查明。历次大版本（v3.1.1/3.3/3.8/3.10/3.11）均以此法保证 88/30 主数据零污染。

### 10.4 回归清单（数据层改动必测）

清洗白名单字段往返（写入 → 刷新 → 读回一致）、墓碑防复活（删 → 新设备同步 → 不复活）、离线暂存补传（断网增 → 联网自动上云）、小数精确保留（占比字段 12.5 不许变 12）、多设备一致性（清缓存重登后数据完整）。

---

## 十一、与用户协作的经验

1. **方案先行，确认后动工**。涉及数据结构/新功能方向的需求（如 v3.8 统计洞察），先给 2~3 个方案带取舍，用户「继续」后再全量实现。方向性返工的成本远高于一轮确认。

2. **用户说「不希望你自己删减」就要逐字审计**。v3.5 图片转文字时做过精简，用户随后明确要求「检查遗漏、不希望自行删减」——v3.6 全量审计补回 45 处。教训：**内容忠实性 > 排版美观**，删改与否的决定权在用户。

3. **「顺便检查一下其他地方」类要求要做系统性体检而不是抽查**。v3.11 移动端检查 = 五档视口 × 5 tab × 3 弹窗全量扫描脚本跑一遍，输出的结论才是「全站唯一问题在 header」这种可拍板结论。

4. **给用户的结论要带验证证据**。「已修复」不如「已修复，线上 360px 实测零溢出 + 截图在这」；「数据安全」不如「四层保险，断云场景线上实测备份自动兜底截图在这」。

5. **向用户解释要有预期管理**。私有仓下线实验时明确告知「你的手机大概率见 404、数据无损、恢复方式是……」；新版本上线告知「老设备 ≤10 分钟自动更新」。用户对过程的容忍度取决于对预期的清晰度。

6. **敏感信息主动隔离**。token 在对话中出现过就提醒用户用后可撤销；保活链接含口令只进用户本地文档；仓库版文档一律脱敏版。让用户不需要自己惦记安全这件事。

7. **用户是产品唯一使用者，体验问题就是最高优先级 bug**。「按钮被挡一小块」在代码里只是几行 CSS，但对每天点它的人来说是每天的不爽。响应要快、修复要彻底（根治布局而不是补丁margin）。

---

## 十二、版本演进时间线

| 版本 | commit | 主题 | 关键经验来源 |
|------|--------|------|-------------|
| v3.0 | cf79634 | 单文件 → 多文件项目，云同步上线 | 架构决策：静态 SPA + Supabase RPC |
| v3.1 | f6fe2f8 | 本地模式体验（引导卡/备份提醒） | agent-browser find text 不可靠 |
| v3.1.1 | 1441ae5 | 小数精确保留 + 周报删除补齐 | parseInt 截断坑；CRUD 完整性 |
| v3.2 | 8c76ab7 | 安全文审加固 + 微信图标 + 移动端 | XSS 六处攻击面；min-width:auto 第一课 |
| v3.2.2 | 4202318 | SW 404 防污染 + 私有仓实验 | 缓存污染；免费版无私有 Pages |
| v3.3 | e642281 | 两按钮 + 秒显 + 图标闪烁修复 | renderedKey 指纹；离线降级不弹门 |
| v3.4 | 38c91d0 | 指导页 6 作者 18 篇上线 | 大内容页分段写入+结构断言 |
| v3.5 | df2200b | 指导页图片全部转文字 | 内容忠实性教训；repo-sync/gl 管线确立 |
| v3.6 | 3d97cc3 | 指导页改当前页跳转 | 导航逻辑一致性 |
| v3.7 | ac05225 | 指导页全量审计补全 45 处 | 逐字比对工作法 |
| v3.8 | 80aa1fb | 统计洞察（周维度 8 卡 + 单篇 TOP10 + 快速补录） | 数据口径先行 |
| v3.9 | 73e89c7 | 云端全量导出 | 双备份口径约定 |
| v3.10+ | 93a0fbc/3c79843 | GitHub 备份通道 + backup_push.py | 幂等设计；敏感扫描固化 |
| v3.10 | 83fc2fd | 断云自动兜底（四层保险闭环） | 场景化排查工作法 |
| v3.11 | 79a27c7 | 手机端 header 溢出根治 | min-width 链路 + html/body 双层锁 |

---

## 十三、本文档的维护约定

1. **每完成一个 Task**，若踩到新坑，同步追加到对应分类（现象/根因/解法/验证 四段式）；若坑属于新类别，新增一章
2. **铁律清单只增不删**；确需废止某条，在条目后注明废止原因与日期
3. 敏感信息零容忍：提交前扫一遍自己写的这章（七类字符串）
4. 与 worklog.md 分工：worklog 是「按时间的流水账」（发生了什么），本文档是「按主题的经验库」（以后怎么做）——同一个坑两处都有时，以本文档为准并保持更新
5. 文档随代码一起走 repo-sync/gl 管线推送；纯文档改动不用 bump SW
