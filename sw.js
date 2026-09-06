/* ═══════════════════════════════════════════════════════
   公众号成长日志 · Service Worker
   · 页面导航：网络优先，断网回退缓存
   · 静态资源：缓存优先，后台更新
   · Supabase 云端 API：永不缓存
   ═══════════════════════════════════════════════════════ */
const CACHE = 'glog-v3.2.862570a8';
const CORE = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/store.js',
  './js/app.js',
  './js/monthly.js',
  './js/card.js',
  './js/ux.js',
  './vendor/chart.umd.min.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/wechat.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('supabase')) return;   // 云端数据永走网络

  /* config.js：网络优先 —— 用户修改云端配置后立即生效；非 200 回退缓存（防私有化 404 污染） */
  if (url.pathname.endsWith('/js/config.js')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (!res.ok) return caches.match(req).then(hit => hit || res);
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  /* 页面导航：网络优先；仅 200 刷新缓存，404/错误页回退缓存（防私有化后缓存被 404 页污染） */
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (!res.ok) return caches.match('./index.html');
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* 其他静态资源：缓存优先 */
  e.respondWith(
    caches.match(req).then(hit =>
      hit ||
      fetch(req).then(res => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit)
    )
  );
});
