# 部署指南：从零上线，全程免费

本指南面向**没有任何服务器**的情况：前端托管在 GitHub Pages，数据存放在 Supabase 免费云数据库。全程约 15 分钟，之后零维护。

```
你的手机 / 电脑浏览器
        │  访问 https://<用户名>.github.io/<仓库名>/
        ▼
GitHub Pages（静态托管，免费）
        │  输入访问口令后，读写数据（HTTPS）
        ▼
Supabase（免费云数据库，口令校验后存取）
        └── log_data 表：你的全部日志数据（单行 JSON）
        └── app_config 表：口令哈希
```

---

## 第一步 · 创建 Supabase 数据库（约 8 分钟）

1. 打开 <https://supabase.com> → **Start your project** → 建议用 GitHub 账号直接登录；
2. **New project**：随便起个名字（如 `growth-log`），数据库密码让它自动生成即可（不用记），区域选 Singapore 或 Tokyo；
3. 等待项目初始化完成（约 1 分钟）；
4. 左侧菜单 **SQL Editor** → **New query**；
5. 打开本仓库的 `sql/setup.sql`，**先做一处修改**——找到下面这一行，把 `改成你的口令` 换成你自己的访问口令（建议 8 位以上，别用生日）：

   ```sql
   values (1, crypt('改成你的口令', gen_salt('bf')))
   ```

6. 整段复制粘贴到 SQL Editor → **Run**，显示 `Success` 即完成；
7. 记下两个值（左侧菜单 **Project Settings → API**）：
   - **Project URL**：形如 `https://xxxxxxxx.supabase.co`
   - **anon / public key**：一长串 `eyJ...` 开头的密钥（这是设计上可公开的密钥，放心放进前端）

> 💡 以后想**修改口令**：在 SQL Editor 里重新执行 `setup.sql` 中第 ② 段（改好口令）即可。

## 第二步 · 填写配置（1 分钟）

编辑 `js/config.js`，把第一步记下的两个值填进去：

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...（你的 anon key）'
};
```

> 不填也能用：应用会以本地模式运行（数据仅存本设备），随时可回来补配置升级云端。

## 第三步 · 上传到 GitHub（3 分钟）

**方式 A：网页上传（最简单）**

1. 登录 GitHub → 右上角 **+** → **New repository** → 起名如 `growth-log`（Public，**不要**勾选初始化 README）；
2. 仓库页点 **uploading an existing file**，把本文件夹里的**全部文件和文件夹**拖进去 → **Commit changes**。

**方式 B：命令行**

```bash
cd growth-log
git init
git add .
git commit -m "公众号成长日志 v3.0"
git branch -M main
git remote add origin https://github.com/<你的用户名>/growth-log.git
git push -u origin main
```

## 第四步 · 开启 GitHub Pages（1 分钟）

1. 仓库页 → **Settings** → 左侧 **Pages**；
2. **Source** 选 `Deploy from a branch`，**Branch** 选 `main` + `/ (root)` → **Save**；
3. 等 1-2 分钟，页面顶部会出现网址：

   ```
   https://<你的用户名>.github.io/growth-log/
   ```

## 第五步 · 验证与迁移旧数据（2 分钟）

1. 电脑浏览器打开上面的网址 → 出现「访问验证」口令门 → 输入你在第一步设置的口令 → 右上角徽标显示「已同步」即部署成功；
2. **迁移历史数据**：打开你原来的本地 `公众号日志.html` → 数据管理 →「导出 JSON 备份」→ 回到新网站 → 数据管理 →「导入历史数据」选择刚才的文件 → 数据合并进云端，手机端打开即自动可见。

## 第六步 · 手机端（1 分钟）

1. 手机浏览器（iOS 用 Safari，Android 用 Chrome）打开同样网址；
2. 输入口令后，**iOS**：分享 → 添加到主屏幕；**Android**：菜单 → 添加到主屏幕 / 安装应用；
3. 之后从桌面图标进入，全屏 App 体验，数据与电脑实时同步。

---

## ❓ 常见问题

**Q：国内能直接访问吗？**
GitHub Pages 的 `github.io` 域名国内通常可以直接访问（个别地区高峰期较慢）。本应用已把 Chart.js、字体等资源全部本地化，无任何被墙的外链，加载速度只取决于 GitHub 本身。想更稳可以绑定自己的域名（仓库 Settings → Pages → Custom domain，配合 DNS 的 CNAME 记录）。

**Q：Supabase 免费版有什么限制？**
免费额度对个人日志绰绰有余（数据库 500MB、每月 5 万次 API 调用）。注意：**项目连续 7 天无任何请求会被自动暂停**，暂停后去 Supabase 项目面板点 Restore 即可恢复，数据不丢；日常使用（每周记录）不会触发。

**Q：口令忘了 / 想改口令？**
在 Supabase SQL Editor 重新运行 `setup.sql` 第 ② 段（改成新口令）。所有已登录设备下次同步时会提示口令失效，重新输入即可。

**Q：换电脑 / 换浏览器后数据在哪？**
云端模式下所有数据在 Supabase，任何设备输入口令即同步全量数据。若你曾用离线浏览产生了未同步的改动，登录后会自动按记录合并（删除过的记录不会被"复活"）。

**Q：如何更新网站？**
修改本地文件后重新 push（或网页上传覆盖）即可。Service Worker 会在后台检测到新版本并自动刷新一次页面，无需手动清缓存。

**Q：数据安全吗？**
- 数据库两张表均启用 RLS 且收回匿名权限，anon key 无法直接读表；
- 所有读写必须经过 RPC 函数，函数内部校验口令的 bcrypt 哈希；
- 口令明文不落库、不进 Git 仓库（只存在于你的 Supabase 里）；
- 建议每隔一两个月用「导出 JSON 备份」留一份本地存档。

**Q：以后想换掉 Supabase？**
数据层做了抽象（`js/store.js`），只要实现同样的"整包读写"接口即可替换为 LeanCloud / Firebase 等，前端其余代码零改动。

---

## 🧰 本地预览

仓库文件是纯静态的，本地任选一种方式运行：

```bash
# Python
python3 -m http.server 8080
# 或 Node
npx serve .
```

然后访问 `http://localhost:8080`。直接双击 index.html 打开也可以运行，但 PWA / Service Worker 功能仅在 http(s) 下生效。
