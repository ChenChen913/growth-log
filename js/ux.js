/* ═══════════════════════════════════════════════════════
   公众号成长日志 · 本地模式体验增强
   ─────────────────────────────────────────────────────────
   仅在「本地模式」（未配置 Supabase）时生效：
   A. 首次访问引导卡 —— 一次性说明数据保存在本设备，
      以及备份 / 主屏幕 / 云同步三件事
   B. 备份提醒 —— 有数据且超过 14 天未导出备份时，
      底部轻提示（关闭后 7 天内不再打扰）
   云端模式下两样都不出现，不打扰已配置用户。
   ═══════════════════════════════════════════════════════ */
(() => {
  const cfg = window.APP_CONFIG || {};
  const isLocal = !(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  const LS = {
    welcome: 'glog_welcome_seen',    // 引导卡已读标记
    backup:  'glog_last_backup',     // 上次导出 JSON 备份的时间戳（app.js 写入）
    dismiss: 'glog_backup_dismiss',  // 提醒被手动关闭的时间戳
  };
  const DAY = 86400000;

  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  function toast(msg, kind) {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 360); }, 2600);
  }

  /* 本机是否已有数据（glog_cache 优先，兼容旧版 wj_* 键） */
  function hasData() {
    try {
      const c = JSON.parse(localStorage.getItem('glog_cache') || 'null');
      if (c && c.payload && ((c.payload.articles || []).length || (c.payload.weeks || []).length)) return true;
      const oa = JSON.parse(localStorage.getItem('wj_articles') || '[]');
      return !!(oa && oa.length);
    } catch (e) { return false; }
  }

  /* ═════════ A. 首次访问引导卡 ═════════ */
  function showWelcome() {
    const overlay = document.createElement('div');
    overlay.className = 'ux-overlay';
    overlay.innerHTML =
      '<div class="ux-card" role="dialog" aria-modal="true" aria-label="使用引导">' +
        '<img class="ux-logo" src="./icons/icon-192.png" alt="">' +
        '<div class="ux-title">欢迎使用公众号成长日志</div>' +
        '<p class="ux-sub">你的数据将保存在<b>这台设备的浏览器</b>中<br>无需注册登录，打开即用</p>' +
        '<div class="ux-point"><span class="ux-n">1</span><div><b>数据仅存本设备</b><i>清除浏览器缓存或更换设备前，请先「导出 JSON 备份」保存数据</i></div></div>' +
        '<div class="ux-point"><span class="ux-n">2</span><div><b>添加到主屏幕</b><i>手机浏览器菜单选择「添加到主屏幕」，像 App 一样全屏使用</i></div></div>' +
        '<div class="ux-point"><span class="ux-n">3</span><div><b>云同步随时可选</b><i>想手机电脑数据互通？按仓库 DEPLOY.md 免费配置，约 10 分钟开通</i></div></div>' +
        '<button class="ux-btn" type="button">开始使用</button>' +
        '<div class="ux-foot">此提示只出现一次</div>' +
      '</div>';

    const close = () => {
      overlay.classList.add('out');
      setTimeout(() => overlay.remove(), 320);
      set(LS.welcome, String(Date.now()));
      maybeBackupBanner();
    };
    overlay.querySelector('.ux-btn').addEventListener('click', close);
    document.body.appendChild(overlay);
  }

  /* ═════════ B. 备份提醒条 ═════════ */
  function maybeBackupBanner() {
    if (!hasData()) return;
    const now = Date.now();
    const last = Number(get(LS.backup) || 0);
    const dismissed = Number(get(LS.dismiss) || 0);
    if (last && now - last < 14 * DAY) return;          // 14 天内备份过
    if (dismissed && now - dismissed < 7 * DAY) return; // 关闭后 7 天冷静期

    const bar = document.createElement('div');
    bar.className = 'ux-banner';
    bar.setAttribute('role', 'status');
    bar.innerHTML =
      '<div class="ux-ico">!</div>' +
      '<div class="ux-banner-txt"><b>备份提醒</b>距离上次备份已超过 14 天，建议导出 JSON 备份，防止清除缓存后数据丢失。</div>' +
      '<button class="ux-banner-btn" type="button">立即备份</button>' +
      '<button class="ux-banner-x" type="button" aria-label="关闭">&times;</button>';

    const remove = () => { bar.classList.add('out'); setTimeout(() => bar.remove(), 320); };

    bar.querySelector('.ux-banner-btn').addEventListener('click', () => {
      try {
        if (typeof window.exportData !== 'function') throw new Error('no exportData');
        window.exportData();
        set(LS.backup, String(now));
        toast('备份文件已开始下载，请妥善保存', 'ok');
        remove();
      } catch (e) {
        toast('备份失败，请重试', 'err');
      }
    });
    bar.querySelector('.ux-banner-x').addEventListener('click', () => {
      set(LS.dismiss, String(now));
      remove();
    });

    document.body.appendChild(bar);
  }

  window.addEventListener('load', () => {
    if (!isLocal) return;
    if (!get(LS.welcome)) showWelcome();
    else maybeBackupBanner();
  });
})();
