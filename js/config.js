/* ═══════════════════════════════════════════════════════
   公众号成长日志 · 配置文件
   ─────────────────────────────────────────────────────
   【云端同步】已启用 ✓
     数据存储在用户自己的 Supabase 项目中：
     · 访问需输入口令（bcrypt 哈希校验，口令明文不落库）
     · 表已启用 RLS，anon/publishable 密钥无法直接读写
     · publishable key 为 Supabase 设计上的公开密钥，泄露无风险
   【改回本地模式】把下面两个值清空即可。
   ═══════════════════════════════════════════════════════ */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://khofojhgphxtttgapzfn.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_scaPszTmODCglHcWFOurcQ_Hmv9_ing'
};
