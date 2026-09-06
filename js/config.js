/* ═══════════════════════════════════════════════════════
   公众号成长日志 · 配置文件
   ─────────────────────────────────────────────────────
   【本地模式】两个值都留空 → 数据只存当前设备浏览器
   【云端同步】填入你的 Supabase 项目信息（见 DEPLOY.md）：
     1. 登录 https://supabase.com 创建项目
     2. SQL Editor 中执行 sql/setup.sql
     3. 项目设置 → API 中复制下面两个值：

   SUPABASE_URL      → Project URL，形如 https://xxxxx.supabase.co
   SUPABASE_ANON_KEY → Project API Keys 中的 anon / public 密钥
   ═══════════════════════════════════════════════════════ */
window.APP_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: ''
};
