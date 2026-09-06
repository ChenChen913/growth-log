/* ═══════════════════════════════════════════════════════════════
   公众号成长日志 · 数据层 Store
   ───────────────────────────────────────────────────────────────
   两种运行模式（由 config.js 自动决定）：
   · local 模式：数据存本设备 localStorage（glog_cache），无口令
   · cloud 模式：数据存 Supabase（RPC: sync_get / sync_save），
     打开网址需输入访问口令，手机 / 电脑 / 多浏览器实时同步

   同步策略（单用户，按记录粒度合并）：
   · 每次改动先写本机缓存（dirty=true），1.6s 防抖后整包推送云端
   · 启动 / 网络恢复时拉取云端整包，与本机待同步数据按 _ts 合并
   · 删除记录写入 tombstones（墓碑），防止多端合并时"复活"
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const cfg = window.APP_CONFIG || {};
  const LS = {
    passcode: 'glog_passcode',   // 已验证的访问口令（记住设备）
    cache:    'glog_cache',      // { payload, dirty, savedAt }
  };

  const mode = (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) ? 'cloud' : 'local';
  let currentPasscode = null;
  let pushTimer = null;
  let onReadyCb = null;
  let dataProvider = null;   // app.js 注入：读取当前文章/周报数据
  let booted = false;

  /* ─────────── 小工具 ─────────── */
  const $ = id => document.getElementById(id);
  const pad2 = n => String(n).padStart(2, '0');
  const timeHM = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

  function toast(msg, kind) {
    const wrap = $('toastWrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 2600);
  }

  function badge(state, text, short) {
    const b = $('syncBadge'), t = $('syncText');
    if (!b || !t) return;
    b.dataset.state = state;                 // ok | busy | err | local
    b.title = text;
    t.textContent = short || text;
    b.classList.add('show');
  }

  /* ─────────── 本机缓存 ─────────── */
  function readCache() {
    try { return JSON.parse(localStorage.getItem(LS.cache)); } catch (e) { return null; }
  }
  function writeCache(payload, dirty) {
    try { localStorage.setItem(LS.cache, JSON.stringify({ payload, dirty, savedAt: Date.now() })); } catch (e) {}
  }
  function blankPayload() {
    return { v: 3, articles: [], weeks: [], avatar: '', tombstones: [], updatedAt: new Date().toISOString() };
  }

  /* 旧版本（单文件时代 wj_* 键）一次性迁移 */
  function migrateLegacy(p) {
    try {
      const oa = localStorage.getItem('wj_articles');
      const ow = localStorage.getItem('wj_weeks');
      const ov = localStorage.getItem('wj_avatar');
      if ((oa || ow || ov) && (p.articles || []).length === 0 && (p.weeks || []).length === 0) {
        if (oa) p.articles = JSON.parse(oa);
        if (ow) p.weeks = JSON.parse(ow);
        if (ov) p.avatar = ov;
        p.updatedAt = new Date().toISOString();
        console.info('[glog] 已从旧版本 localStorage 迁移历史数据');
      }
    } catch (e) {}
    return p;
  }

  function normalize(raw) {
    const p = blankPayload();
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.articles)) p.articles = raw.articles;
      if (Array.isArray(raw.weeks))    p.weeks    = raw.weeks;
      if (typeof raw.avatar === 'string') p.avatar = raw.avatar;
      if (Array.isArray(raw.tombstones))  p.tombstones = raw.tombstones;
    }
    return p;
  }

  /* ─────────── 合并引擎 ───────────
     remote：云端整包；localDirty：本机有未同步改动的整包
     按记录 _ts 取并集；同 _ts 本机优先（本机是刚编辑过的）；
     两边墓碑并集，被删除的记录不参与合并 */
  function mergePayload(remote, localDirty) {
    const tomb = new Set([...(remote.tombstones || []), ...(localDirty.tombstones || [])]);
    const amap = new Map();
    (remote.articles || []).forEach(a => amap.set(a._ts, a));
    (localDirty.articles || []).forEach(a => amap.set(a._ts, a));
    const wmap = new Map();
    (remote.weeks || []).forEach(w => wmap.set(w._ts, w));
    (localDirty.weeks || []).forEach(w => wmap.set(w._ts, w));
    return {
      v: 3,
      articles: [...amap.values()].filter(a => !tomb.has(a._ts)),
      weeks:    [...wmap.values()].filter(w => !tomb.has(w._ts)),
      avatar:   localDirty.avatar || remote.avatar || '',
      tombstones: [...tomb].slice(-300),
      updatedAt: new Date().toISOString()
    };
  }

  /* ─────────── Supabase RPC（纯 fetch，无 SDK 依赖）─────────── */
  async function rpc(fn, body) {
    const url = cfg.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cfg.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + cfg.SUPABASE_ANON_KEY
        },
        body: JSON.stringify(body)
      });
    } catch (e) { const err = new Error('OFFLINE'); err.code = 'OFFLINE'; throw err; }
    if (!res.ok) {
      let msg = '';
      try { msg = (await res.json()).message || ''; } catch (e) {}
      if (msg.includes('ACCESS_DENIED')) { const err = new Error('ACCESS_DENIED'); err.code = 'ACCESS_DENIED'; throw err; }
      const err = new Error('RPC_ERROR'); err.code = 'RPC_ERROR'; err.detail = msg || ('HTTP ' + res.status); throw err;
    }
    return res.json();
  }
  const pull = () => rpc('sync_get', { p_code: currentPasscode });
  const push = payload => rpc('sync_save', { p_code: currentPasscode, p_payload: payload });

  /* ─────────── 推送（防抖 + 失败暂存）─────────── */
  function schedulePush(delay) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(doPush, delay === undefined ? 1600 : delay);
  }
  async function doPush() {
    const payload = readWorkingPayload();
    if (!payload) return;
    try {
      await push(payload);
      const c = readCache();
      if (c) writeCache(c.payload, false);
      badge('ok', '已同步 · ' + timeHM(), '已同步 ' + timeHM());
      toast('云端已同步', 'ok');
    } catch (e) {
      if (e.code === 'ACCESS_DENIED') {
        badge('err', '口令已失效，请重新验证', '口令失效');
        localStorage.removeItem(LS.passcode);
        showGate('口令已失效，请重新输入');
      } else {
        badge('err', '离线 · 改动已暂存，联网后自动同步', '离线待同步');
      }
    }
  }

  /* 读取当前工作数据（app.js 通过 setDataProvider 注入读取器） */
  function readWorkingPayload() {
    if (!dataProvider) return null;
    let d;
    try { d = dataProvider() || {}; } catch (e) { return null; }
    return {
      v: 3,
      articles: d.articles || [],
      weeks: d.weeks || [],
      avatar: d.avatar || '',
      tombstones: d.tombstones || [],
      updatedAt: new Date().toISOString()
    };
  }

  /* ─────────── 口令门 ─────────── */
  function showGate(msg) {
    const ov = $('gateOverlay');
    if (!ov) return;
    $('gateError').textContent = msg || '';
    $('gateOffline').style.display = readCache() && readCache().payload ? 'inline-block' : 'none';
    ov.classList.add('show');
    setTimeout(() => $('gateInput').focus(), 120);
  }
  function hideGate() { const ov = $('gateOverlay'); if (ov) ov.classList.remove('show'); }

  function bindGate() {
    const input = $('gateInput'), btn = $('gateBtn');
    if (!input) return;
    const submit = () => {
      const code = input.value.trim();
      if (!code) { $('gateError').textContent = '请输入访问口令'; return; }
      btn.disabled = true; btn.textContent = '验证中…';
      tryVerify(code, false).finally(() => { btn.disabled = false; btn.textContent = '进入'; });
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    $('gateOffline').addEventListener('click', offlineBrowse);
  }

  async function tryVerify(code, silent) {
    currentPasscode = code;
    badge('busy', '正在连接云端…', '连接中…');
    try {
      const remote = normalize(await pull());
      localStorage.setItem(LS.passcode, code);
      hideGate();
      const cached = readCache();
      let payload;
      if (cached && cached.dirty && cached.payload) {
        payload = mergePayload(remote, cached.payload);
        writeCache(payload, true);
        bootNow(payload);
        schedulePush(300);
      } else {
        writeCache(remote, false);
        bootNow(remote);
        badge('ok', '已同步 · ' + timeHM(), '已同步 ' + timeHM());
      }
      return true;
    } catch (e) {
      currentPasscode = null;
      if (e.code === 'ACCESS_DENIED') {
        localStorage.removeItem(LS.passcode);
        if (!silent) showGate('口令不正确，请重试'); else showGate('');
        badge('err', '等待口令验证', '待验证');
      } else {
        showGate(e.code === 'OFFLINE'
          ? '网络不可用，请检查网络后重试，或先离线浏览'
          : '连接云端失败（' + (e.detail || '请检查 Supabase 配置') + '），可先离线浏览');
        badge('err', '云端连接失败', '连接失败');
      }
      return false;
    }
  }

  async function offlineBrowse() {
    const c = readCache();
    if (c && c.payload) {
      hideGate();
      bootNow(normalize(c.payload));
      badge('err', '离线浏览 · 联网后自动同步', '离线浏览中');
    }
  }

  /* ─────────── 启动流程 ─────────── */
  function bootNow(payload) {
    if (booted) return;
    booted = true;
    window.__GLOG_TOMB__ = payload.tombstones || [];
    if (onReadyCb) onReadyCb(payload, { mode });
  }

  function start() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else { init(); }
  }
  function init() {
    bindGate();
    if (mode === 'local') {
      badge('local', '本地模式 · 数据仅存本设备', '本地模式');
      const cached = readCache();
      const payload = normalize(cached && cached.payload ? cached.payload : null);
      migrateLegacy(payload);
      writeCache(payload, false);
      bootNow(payload);
    } else {
      const saved = localStorage.getItem(LS.passcode);
      if (saved) tryVerify(saved, true); else showGate('');
    }
  }

  /* 网络恢复 / 回到前台 → 冲洗未同步改动 */
  window.addEventListener('online', () => {
    if (mode === 'cloud' && booted) {
      const c = readCache();
      if (c && c.dirty) schedulePush(800);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && mode === 'cloud' && booted) {
      const c = readCache();
      if (c && c.dirty) schedulePush(600);
    }
  });

  /* ─────────── 对 app.js 暴露的接口 ─────────── */
  window.Store = {
    start,
    onReady(cb) { onReadyCb = cb; },
    setDataProvider(fn) { dataProvider = fn; },
    /* app.js 每次数据变动后调用 */
    persist() {
      const payload = readWorkingPayload();
      if (!payload) return;
      writeCache(payload, true);
      if (mode === 'cloud') { badge('busy', '同步中…', '同步中…'); schedulePush(); }
    },
    get mode() { return mode; },
    toast,
    badge,
    logout() { localStorage.removeItem(LS.passcode); location.reload(); }
  };

  window.Store.start();
})();
