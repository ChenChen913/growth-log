/* ========================================
   CONSTANTS
======================================== */
const TYPE_MAP   = { article:'文章', imgtext:'图文', video:'视频', audio:'音频' };
const TYPE_COLOR = { article:'#1d6b3e', imgtext:'#1d4d72', video:'#a33d1e', audio:'#5a3a8a' };
const TYPE_BG    = { article:'badge-article', imgtext:'badge-imgtext', video:'badge-video', audio:'badge-audio' };
const TYPE_FILL  = { article:'#2d7a4f', imgtext:'#2a5f8a', video:'#c0522a', audio:'#6b4fa0' };
const SRC_COLORS =['#07C160','#34b89a','#5b9bd5','#e8a838','#9b6dd6','#e86060','#a0aab8'];
const SRC_NAMES  =['搜一搜','推荐','朋友圈','公众号主页','公众号消息','聊天会话','其他'];

const AI_MAP = { 0: '未使用', 1: '轻度使用', 2: '高度使用' };
const AI_BG  = { 0: 'badge-ai-0', 1: 'badge-ai-1', 2: 'badge-ai-2' };
const AI_COLORS =['#81c784', '#ffb74d', '#e53935']; // 淡绿, 橘黄, 红色

/* ========================================
   DATA STORE
======================================== */
let articles = [];
let weeks    = [];
let avatar   = '';

function persist() { Store.persist(); }

function initAvatarListener() {
  document.getElementById('avatarInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      avatar = ev.target.result;
      Store.persist();
      applyAvatar(avatar);
    };
    reader.readAsDataURL(file);
  });
}

function applyAvatar(src) {
  const img = document.getElementById('avatarImg');
  const def = document.getElementById('avatarDefault');
  img.src = src; img.style.display = 'block'; def.style.display = 'none';
}

function numFmt(n) { return (n >= 10000) ? (n / 10000).toFixed(1) + '万' : (n||0).toLocaleString('zh-CN'); }
function esc(str) { return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmtDatetime(iso) {
  if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return '—';
  const pad = n => String(n).padStart(2,'0'); return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ========================================
   SCROLL EVENT (回到顶部)
======================================== */
function checkBackToTop() {
  const btn = document.getElementById('backToTopBtn');
  const activePanel = document.querySelector('.panel.active');
  if (window.scrollY > 300 && activePanel && activePanel.id !== 'panel-overview') {
    btn.classList.add('show');
  } else {
    btn.classList.remove('show');
  }
}
window.addEventListener('scroll', checkBackToTop);

function switchTab(name, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
  if (name === 'overview') renderOverview();
  if (name === 'articles') renderArticleTable();
  if (name === 'weeks') { renderWeekList(); renderTrendLine(); }
  if (name === 'monthly') renderMonthly();
  checkBackToTop();
}

/* ========================================
   OVERVIEW 
======================================== */
let typeInst = null;
let aiInst = null;

function renderOverview() {
  const totalReads  = weeks.reduce((s,w) => s + (w.reads||0), 0);
  const totalShares = weeks.reduce((s,w) => s + (w.shares||0), 0);
  document.getElementById('s-reads').textContent    = numFmt(totalReads);
  document.getElementById('s-articles').textContent = articles.length;
  document.getElementById('s-shares').textContent   = numFmt(totalShares);
  document.getElementById('s-weeks').textContent    = weeks.length;
  renderTypeChart();
  renderAIChart(); 
  renderTypeSummary();
}

let currentTypeChart = 'bar';
function switchTypeChart(type) {
  currentTypeChart = type;
  document.getElementById('typeChartBar').style.background = type === 'bar' ? 'white' : 'transparent';
  document.getElementById('typeChartBar').style.color      = type === 'bar' ? 'var(--ink-mid)' : 'var(--ink-light)';
  document.getElementById('typeChartPie').style.background = type === 'pie' ? 'white' : 'transparent';
  document.getElementById('typeChartPie').style.color      = type === 'pie' ? 'var(--ink-mid)' : 'var(--ink-light)';
  renderTypeChart();
}

function renderTypeChart() {
  const counts = { article:0, imgtext:0, video:0, audio:0 };
  articles.forEach(a => { if (counts[a.type] !== undefined) counts[a.type]++; });
  const data  =[counts.article, counts.imgtext, counts.video, counts.audio];
  const colors =['#2d7a4f','#2a5f8a','#c0522a','#6b4fa0'];

  if (typeInst) typeInst.destroy();
  const ctx = document.getElementById('typeChart').getContext('2d');
  if (currentTypeChart === 'bar') {
    typeInst = new Chart(ctx, { type: 'bar', data: { labels:['文章','图文','视频','音频'], datasets:[{ data, backgroundColor: colors, borderRadius: 7 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } } });
  } else {
    typeInst = new Chart(ctx, { type: 'doughnut', data: { labels:['文章','图文','视频','音频'], datasets:[{ data, backgroundColor: colors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: true, position: 'right' } } } });
  }
}

function renderAIChart() {
  const counts = { 0: 0, 1: 0, 2: 0 };
  articles.forEach(a => { counts[a.aiUsage || 0]++; });
  const data =[counts[0], counts[1], counts[2]];

  if (aiInst) aiInst.destroy();
  const ctx = document.getElementById('aiChart').getContext('2d');
  aiInst = new Chart(ctx, { type: 'pie', data: { labels:['未使用', '轻度使用', '高度使用'], datasets:[{ data, backgroundColor: AI_COLORS, borderWidth: 0, hoverOffset: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'right', labels: { font: { size: 13, family: "'PingFang SC', 'Microsoft YaHei', sans-serif" }, color: '#3d4450', padding: 16, boxWidth: 12 } }, tooltip: { backgroundColor: 'rgba(28,33,40,0.88)', padding: 12 } } } });
}

function renderTypeSummary() {
  const counts = { article:0, imgtext:0, video:0, audio:0 };
  articles.forEach(a => { if (counts[a.type] !== undefined) counts[a.type]++; });
  const total = articles.length || 1;
  document.getElementById('typeSummary').innerHTML =['article','imgtext','video','audio'].map(t => `<div class="type-row"><div class="type-name">${TYPE_MAP[t]}</div><div class="type-track"><div class="type-fill" style="width:${Math.round(counts[t]/total*100)}%;background:${TYPE_FILL[t]}"></div></div><div class="type-count">${counts[t]}</div></div>`).join('');
}

/* ========================================
   ARTICLE TABLE
======================================== */
let currentFilter = 'all';
function filterArticles(type, btn) {
  currentFilter = type;
  document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderArticleTable();
}

function renderArticleTable() {
  let filtered = (currentFilter === 'all' ? [...articles] : articles.filter(a => a.type === currentFilter));

  if (searchKeyword) filtered = filtered.filter(a => (a.title || '').toLowerCase().includes(searchKeyword));
  if (searchFrom) filtered = filtered.filter(a => (a.datetime || '').slice(0, 10) >= searchFrom);
  if (searchTo)   filtered = filtered.filter(a => (a.datetime || '').slice(0, 10) <= searchTo);

  if (searchSort === 'time_desc')      filtered.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  else if (searchSort === 'time_asc')  filtered.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  else if (searchSort === 'title_asc') filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-Hans-CN'));

  const chip = document.getElementById('articleCount');
  if (chip) {
    const filtering = searchKeyword || searchFrom || searchTo || currentFilter !== 'all';
    chip.innerHTML = filtering
      ? `筛选结果 <b>${filtered.length}</b> / ${articles.length} 条记录`
      : `共 <b>${articles.length}</b> 条记录`;
  }

  const body = document.getElementById('articleTableBody');
  if (filtered.length === 0) {
    const searching = searchKeyword || searchFrom || searchTo;
    body.innerHTML = `<div class="empty-tip"><strong>${searching ? '没有匹配的记录' : '暂无记录'}</strong>${searching ? '试试调整关键词或时间范围' : '点击「记录文章」开始你的第一条记录'}</div>`;
    return;
  }

  body.innerHTML = filtered.map((a, i) => `
    <div class="article-row" style="animation-delay:${i * 0.04}s">
      <div class="art-title">${esc(a.title) || '（无标题）'}</div>
      <div><span class="art-type-badge ${TYPE_BG[a.type] || 'badge-article'}">${TYPE_MAP[a.type] || esc(a.type)}</span></div>
      <div>${a.original !== 0 ? '<span class="badge-original">原创</span>' : '<span class="badge-repost">转载</span>'}</div>
      <div><span class="badge-ai ${AI_BG[a.aiUsage || 0]}">${AI_MAP[a.aiUsage || 0]}</span></div>
      <div class="art-date">${fmtDatetime(a.datetime)}</div>
      <div class="art-actions">
        <button class="edit-btn" onclick="openEditArticleModal(${Number(a._ts) || 0})">编辑</button>
        <button class="del-btn" onclick="deleteArticle(${Number(a._ts) || 0})">删除</button>
      </div>
    </div>`).join('');
}

function deleteArticle(ts) {
  if (!confirm('确认删除这篇文章记录？')) return;
  articles = articles.filter(a => a._ts !== ts);
  addTombstone(ts);
  persist(); renderArticleTable(); renderOverview();
}

function openArticleModal() {
  const now = new Date(); document.getElementById('a_datetime').value = new Date(now - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  document.getElementById('a_title').value = ''; document.getElementById('a_type').value = 'article';
  document.getElementById('a_original_yes').checked = true; document.getElementById('a_ai_0').checked = true;
  document.getElementById('articleOverlay').classList.add('show');
}
function closeArticleModal() { document.getElementById('articleOverlay').classList.remove('show'); }
function saveArticle() {
  const title = document.getElementById('a_title').value.trim(); const type = document.getElementById('a_type').value; const datetime = document.getElementById('a_datetime').value; const original = document.getElementById('a_original_yes').checked ? 1 : 0;
  let aiUsage = 0; if (document.getElementById('a_ai_1').checked) aiUsage = 1; if (document.getElementById('a_ai_2').checked) aiUsage = 2;
  if (!title) { alert('请填写文章标题'); return; } if (!datetime) { alert('请选择发布时间'); return; }
  articles.push({ _ts: Date.now(), title, type, datetime, original, aiUsage });
  persist(); closeArticleModal(); renderArticleTable(); renderOverview();
}

function openEditArticleModal(ts) {
  const a = articles.find(x => x._ts === ts); if (!a) return;
  document.getElementById('ea_ts').value = ts; document.getElementById('ea_title').value = a.title || '';
  document.getElementById('ea_type').value = a.type || 'article'; document.getElementById('ea_datetime').value = a.datetime || '';
  if (a.original !== 0) document.getElementById('ea_original_yes').checked = true; else document.getElementById('ea_original_no').checked = true;
  document.getElementById('ea_ai_' + (a.aiUsage || 0)).checked = true;
  document.getElementById('editArticleOverlay').classList.add('show');
}
function closeEditArticleModal() { document.getElementById('editArticleOverlay').classList.remove('show'); }
function updateArticle() {
  const ts = parseInt(document.getElementById('ea_ts').value); const idx = articles.findIndex(x => x._ts === ts);
  if (idx === -1) { alert('找不到该记录'); return; }
  const title = document.getElementById('ea_title').value.trim(); const type = document.getElementById('ea_type').value; const datetime = document.getElementById('ea_datetime').value; const original = document.getElementById('ea_original_yes').checked ? 1 : 0;
  let aiUsage = 0; if (document.getElementById('ea_ai_1').checked) aiUsage = 1; if (document.getElementById('ea_ai_2').checked) aiUsage = 2;
  articles[idx] = { ...articles[idx], title, type, datetime, original, aiUsage };
  persist(); closeEditArticleModal(); renderArticleTable(); renderOverview();
}

/* ========================================
   WEEK LIST & MODALS
======================================== */
const drawnDonuts = new Set();
function renderWeekList() {
  drawnDonuts.clear();
  const container = document.getElementById('weekList');
  if (weeks.length === 0) { container.innerHTML = `<div class="empty-tip"><strong>暂无周报告</strong>点击「记录本周数据」开始</div>`; return; }
  const sorted = [...weeks].sort((a,b) => (b._sortTs||b._ts) - (a._sortTs||a._ts));
  container.innerHTML = sorted.map((w, i) => buildWeekCard(w, sorted.length - i, i)).join('');
}
function buildWeekCard(w, num, delay) {
  const total = (w.article||0)+(w.imgtext||0)+(w.video||0)+(w.audio||0);
  const maxCt = Math.max(w.article||0, w.imgtext||0, w.video||0, w.audio||0, 1);
  const ctBars =['article','imgtext','video','audio'].map(t => `<div class="ct-row"><div class="ct-name">${TYPE_MAP[t]}</div><div class="ct-track"><div class="ct-fill" style="width:${Math.round((w[t]||0)/maxCt*100)}%;background:${TYPE_FILL[t]}"></div></div><div class="ct-num">${w[t]||0}</div></div>`).join('');
  const srcLegend = SRC_NAMES.map((n,i) => `<div class="src-row"><div class="src-bar" style="background:${SRC_COLORS[i]}"></div><span>${n}</span><span class="src-val">${[w.s1||0,w.s2||0,w.s3||0,w.s4||0,w.s5||0,w.s6||0,w.s7||0][i]}%</span></div>`).join('');
  const noteHtml = w.note ? `<div class="journal-section"><div class="journal-text">${esc(w.note)}</div></div>` : `<div class="journal-section"><div class="journal-empty">本周暂无感悟记录</div></div>`;
  const newfansStr = w.newfans > 0 ? `<span style="font-size:12px;color:var(--green);margin-left:6px;font-family:var(--sans);">+${w.newfans}</span>` : w.newfans < 0 ? `<span style="font-size:12px;color:#c0392b;margin-left:6px;font-family:var(--sans);">${w.newfans}</span>` : '';
  return `
<div class="week-card" id="wc-${Number(w._ts) || 0}" style="animation-delay:${delay*0.06}s">
  <div class="week-head" onclick="toggleWeek(${Number(w._ts) || 0})">
    <div class="week-num">No.${String(num).padStart(2,'0')}</div>
    <div class="week-info"><div class="week-name">${esc(w.label||'本周')}</div><div class="week-range">${esc(w.range||'')}${w.wdate ? ' · ' + w.wdate : ''}</div></div>
    <div class="week-pills">
      <div class="pill-item"><div class="pill-val">${numFmt(w.reads)}</div><div class="pill-lbl">阅读量</div></div>
      <div class="pill-item"><div class="pill-val">${numFmt(w.fans||0)}${newfansStr}</div><div class="pill-lbl">粉丝量</div></div>
      <div class="pill-item"><div class="pill-val">${total}</div><div class="pill-lbl">内容数</div></div>
      <div class="pill-item"><div class="pill-val">${numFmt(w.shares)}</div><div class="pill-lbl">分享数</div></div>
    </div>
    <div class="expand-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></div>
    <div class="week-card-actions" onclick="event.stopPropagation()"><button class="edit-btn" onclick="openEditWeekModal(${Number(w._ts) || 0})">编辑</button><button class="del-btn" onclick="deleteWeek(${Number(w._ts) || 0})">删除</button></div>
  </div>
  <div class="week-body"><div class="body-grid"><div><div class="col-label">内容发布构成</div><div class="ct-list">${ctBars}</div></div><div><div class="col-label">阅读来源占比</div><div class="source-layout"><div class="donut-wrap"><canvas id="donut-${Number(w._ts) || 0}"></canvas></div><div class="src-legend">${srcLegend}</div></div></div></div>${noteHtml}</div>
</div>`;
}

function toggleWeek(ts) {
  const card = document.getElementById('wc-' + ts);
  const wasOpen = card.classList.contains('open');
  card.classList.toggle('open');
  if (!wasOpen && !drawnDonuts.has(ts)) {
    drawnDonuts.add(ts);
    setTimeout(() => {
      const w = weeks.find(x => x._ts === ts);
      const canvas = document.getElementById('donut-' + ts);
      if (!w || !canvas) return;
      new Chart(canvas.getContext('2d'), { type: 'doughnut', data: { labels: SRC_NAMES, datasets: [{ data:[w.s1||0, w.s2||0, w.s3||0, w.s4||0, w.s5||0, w.s6||0, w.s7||0], backgroundColor: SRC_COLORS, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } }, animation: { animateRotate: true, duration: 800 } } });
    }, 40);
  }
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function autoFillWeek() {
  const val = document.getElementById('w_date').value;
  if (!val) return;
  const d = new Date(val + 'T00:00:00');
  const day = d.getDay() || 7;
  const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const pad2 = n => String(n).padStart(2,'0'); 
  const fmt  = dt => `${dt.getMonth()+1}.${pad2(dt.getDate())}`;
  document.getElementById('w_label').value = `${monday.getFullYear()}年第${getWeekNumber(monday)}周`;
  document.getElementById('w_range').value = `${fmt(monday)} – ${fmt(sunday)}`;
}

function openWeekModal() {['w_reads','w_shares','w_fans','w_newfans','w_article','w_imgtext','w_video','w_audio','w_s1','w_s2','w_s3','w_s4','w_s5','w_s6','w_s7','w_note'].forEach(id => { document.getElementById(id).value = ''; });
  const now = new Date(); const day = now.getDay() || 7; const monday = new Date(now); monday.setDate(now.getDate() - day + 1);
  document.getElementById('w_date').value = monday.toISOString().slice(0,10);
  autoFillWeek();
  document.getElementById('weekOverlay').classList.add('show');
}

function closeWeekModal() { document.getElementById('weekOverlay').classList.remove('show'); }

function saveWeek() {
  const label = document.getElementById('w_label').value.trim();
  if (!label) { alert('请填写周期名称'); return; }
  const n  = id => parseInt(document.getElementById(id).value) || 0;
  const f  = id => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? 0 : Math.round(v * 10) / 10; };
  const wdate = document.getElementById('w_date').value;
  const sortTs = wdate ? new Date(wdate).getTime() : Date.now();
  weeks.push({ 
    _ts: Date.now(), _sortTs: sortTs, label, 
    range: document.getElementById('w_range').value.trim(), wdate, 
    reads: n('w_reads'), shares: n('w_shares'), fans: n('w_fans'), newfans: parseInt(document.getElementById('w_newfans').value) || 0, 
    article: n('w_article'), imgtext: n('w_imgtext'), video: n('w_video'), audio: n('w_audio'), 
    s1: f('w_s1'), s2: f('w_s2'), s3: f('w_s3'), s4: f('w_s4'), s5: f('w_s5'), s6: f('w_s6'), s7: f('w_s7'), 
    note: document.getElementById('w_note').value.trim() 
  });
  persist(); closeWeekModal(); renderOverview();
  if (document.getElementById('panel-weeks').classList.contains('active')) renderWeekList();
}

function openEditWeekModal(ts) {
  const w = weeks.find(x => x._ts === ts); if (!w) return;
  document.getElementById('ew_ts').value = ts;['ew_date','ew_label','ew_range','ew_reads','ew_shares','ew_fans','ew_newfans','ew_article','ew_imgtext','ew_video','ew_audio','ew_s1','ew_s2','ew_s3','ew_s4','ew_s5','ew_s6','ew_s7','ew_note'].forEach(id => {
    document.getElementById(id).value = w[id.replace('ew_','')] || '';
  });
  document.getElementById('ew_date').value = w.wdate || '';
  document.getElementById('editWeekOverlay').classList.add('show');
}

function closeEditWeekModal() { document.getElementById('editWeekOverlay').classList.remove('show'); }

function autoFillEditWeek() {
  const val = document.getElementById('ew_date').value; if (!val) return;
  const d = new Date(val + 'T00:00:00'); const day = d.getDay() || 7;
  const monday = new Date(d); monday.setDate(d.getDate() - day + 1); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const pad2 = n => String(n).padStart(2,'0'); const fmt  = dt => `${dt.getMonth()+1}.${pad2(dt.getDate())}`;
  document.getElementById('ew_label').value = `${monday.getFullYear()}年第${getWeekNumber(monday)}周`;
  document.getElementById('ew_range').value = `${fmt(monday)} – ${fmt(sunday)}`;
}

function updateWeek() {
  const ts = parseInt(document.getElementById('ew_ts').value); const idx = weeks.findIndex(x => x._ts === ts);
  if (idx === -1) { alert('找不到该记录'); return; }
  const label = document.getElementById('ew_label').value.trim(); if (!label) { alert('请填写周期名称'); return; }
  const n = id => parseInt(document.getElementById(id).value) || 0;
  const f = id => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? 0 : Math.round(v * 10) / 10; };
  const wdate = document.getElementById('ew_date').value;
  weeks[idx] = { 
    ...weeks[idx], label, wdate, _sortTs: wdate ? new Date(wdate).getTime() : weeks[idx]._sortTs, 
    range: document.getElementById('ew_range').value.trim(), 
    reads: n('ew_reads'), shares: n('ew_shares'), fans: n('ew_fans'), newfans: parseInt(document.getElementById('ew_newfans').value) || 0, 
    article: n('ew_article'), imgtext: n('ew_imgtext'), video: n('ew_video'), audio: n('ew_audio'), 
    s1: f('ew_s1'), s2: f('ew_s2'), s3: f('ew_s3'), s4: f('ew_s4'), s5: f('ew_s5'), s6: f('ew_s6'), s7: f('ew_s7'), 
    note: document.getElementById('ew_note').value.trim() 
  };
  persist(); closeEditWeekModal(); renderOverview(); drawnDonuts.delete(ts); renderWeekList();
  if (document.getElementById('panel-weeks').classList.contains('active')) renderTrendLine();
}

/* 周报删除：与 deleteArticle 对称，墓碑防多端复活 */
function deleteWeek(ts) {
  if (!confirm('确认删除这条周报记录？')) return;
  weeks = weeks.filter(w => w._ts !== ts);
  addTombstone(ts);
  persist(); renderWeekList(); renderOverview();
  if (document.getElementById('panel-weeks').classList.contains('active')) renderTrendLine();
}

/* ========================================
   TREND CHART
======================================== */
let trendMetric = 'reads'; let trendRange  = '7'; let trendLineInst = null;
const METRIC_META = { reads: { label: '阅读量', color: '#07C160' }, fans: { label: '粉丝量', color: '#5b9bd5' }, shares: { label: '分享数', color: '#e8a838' }, content: { label: '内容数', color: '#9b6dd6' } };
function setMetric(m, btn) { trendMetric = m; document.querySelectorAll('#metricGroup .ctrl-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderTrendLine(); }
function setRange(r, btn) { trendRange = r; document.querySelectorAll('#rangeGroup .ctrl-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); const custom = document.getElementById('trendCustomRange'); if (r === 'custom') { custom.classList.add('show'); const now = new Date(); const ago = new Date(now); ago.setDate(now.getDate() - 90); document.getElementById('trendFrom').value = ago.toISOString().slice(0,10); document.getElementById('trendTo').value = now.toISOString().slice(0,10); } else { custom.classList.remove('show'); } renderTrendLine(); }
function renderTrendLine() {
  const now = new Date(); let sorted = [...weeks].sort((a,b) => (a._sortTs||a._ts) - (b._sortTs||b._ts));
  if (trendRange === '7') { const cutoff = new Date(now); cutoff.setDate(now.getDate() - 7); sorted = sorted.filter(w => new Date(w.wdate||w._ts) >= cutoff); }
  else if (trendRange === '30') { const cutoff = new Date(now); cutoff.setDate(now.getDate() - 30); sorted = sorted.filter(w => new Date(w.wdate||w._ts) >= cutoff); }
  else if (trendRange === 'custom') { const from = document.getElementById('trendFrom').value; const to = document.getElementById('trendTo').value; if (from) sorted = sorted.filter(w => (w.wdate||'') >= from); if (to) sorted = sorted.filter(w => (w.wdate||'') <= to); }
  const canvas = document.getElementById('trendLineChart');
  if (trendLineInst) trendLineInst.destroy();
  if (sorted.length === 0) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';
  const labels = sorted.map(w => w.range ? w.range.split('–')[0].trim() : (w.wdate||''));
  const meta = METRIC_META[trendMetric];
  const values = sorted.map(w => trendMetric === 'content' ? (w.article||0)+(w.imgtext||0)+(w.video||0)+(w.audio||0) : (w[trendMetric] || 0));
  const ctx = canvas.getContext('2d');
  const hexToRgba = (hex, a) => `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
  const grad2 = ctx.createLinearGradient(0, 0, 0, 260); grad2.addColorStop(0, hexToRgba(meta.color, 0.15)); grad2.addColorStop(1, hexToRgba(meta.color, 0.00));
  trendLineInst = new Chart(ctx, { type: 'line', data: { labels, datasets:[{ label: meta.label, data: values, borderColor: meta.color, backgroundColor: grad2, borderWidth: 2.5, pointBackgroundColor: meta.color, pointBorderColor: 'white', fill: true, tension: 0.38 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } } });
}

/* ========================================
   EXPORT & IMPORT
======================================== */
function exportData() {
  const payload = { _meta: { exportedAt: new Date().toISOString(), appName: '公众号成长日志', version: '3.0' }, articles, weeks, avatar: avatar || '', tombstones: window.__GLOG_TOMB__ || [] };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '公众号成长日志_备份_' + new Date().toISOString().slice(0,10) + '.json'; a.click(); URL.revokeObjectURL(a.href);
  try { localStorage.setItem('glog_last_backup', String(Date.now())); } catch (e) {}
}

function exportDetailedData() {
  const report = {
    _meta: { exportedAt: new Date().toISOString(), reportType: 'detailed', version: '2.0' },
    summary: { 总周数: weeks.length, 总文章数: articles.length },
    articles: articles.map(a => ({
      标题: a.title, 类型: TYPE_MAP[a.type] || a.type, 是否原创: a.original !== 0 ? '原创' : '转载',
      AI辅助: AI_MAP[a.aiUsage || 0], 发布时间: a.datetime ? new Date(a.datetime).toLocaleString('zh-CN') : '未记录'
    })),
    weeks: weeks.map(w => ({ 周名称: w.label, 日期范围: w.range, 阅读量: w.reads, 新增粉丝: w.newfans }))
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '公众号成长日志_详细报告_' + new Date().toISOString().slice(0,10) + '.json'; a.click(); URL.revokeObjectURL(a.href);
}

function triggerImport() { document.getElementById('importFileInput').click(); }
function importData(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.articles) || !Array.isArray(data.weeks)) { alert('格式不正确：缺少 articles / weeks 数据'); return; }
      if (!confirm('检测到备份文件，是否合并导入？（相同记录自动去重）')) { event.target.value = ''; return; }
      const cleanArticles = data.articles.map(Store.sanitizeArticle).filter(Boolean);   // 字段级清洗，防恶意/损坏数据
      const cleanWeeks    = data.weeks.map(Store.sanitizeWeek).filter(Boolean);
      const existingArticleTs = new Set(articles.map(a => a._ts));
      const existingWeekTs = new Set(weeks.map(w => w._ts));
      let addedA = 0, addedW = 0;
      cleanArticles.forEach(a => { if (!existingArticleTs.has(a._ts)) { articles.push(a); addedA++; } });
      cleanWeeks.forEach(w => { if (!existingWeekTs.has(w._ts)) { weeks.push(w); addedW++; } });
      if (!avatar && typeof data.avatar === 'string' && data.avatar) { avatar = data.avatar; applyAvatar(avatar); }
      persist(); renderOverview(); renderArticleTable(); renderWeekList();
      event.target.value = '';
      Store.toast('导入成功：新增 ' + addedA + ' 篇文章，' + addedW + ' 条周报', 'ok');
    } catch(err) { alert('解析失败：' + err.message); event.target.value = ''; }
  };
  reader.readAsText(file);
}

/* ========================================
   MODAL OVERLAY CLICK CLOSE
======================================== */['articleOverlay','editArticleOverlay','weekOverlay','editWeekOverlay','cardPreviewOverlay'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('show');
  });
});


/* ========================================
   v3.0 · 搜索筛选状态
======================================== */
let searchKeyword = '';
let searchFrom = '';
let searchTo = '';
let searchSort = 'time_desc';

function initSearchBar() {
  const kw = document.getElementById('articleSearch');
  const from = document.getElementById('articleFrom');
  const to = document.getElementById('articleTo');
  const sort = document.getElementById('articleSort');
  if (!kw) return;
  kw.addEventListener('input', () => { searchKeyword = kw.value.trim().toLowerCase(); renderArticleTable(); });
  from.addEventListener('change', () => { searchFrom = from.value; renderArticleTable(); });
  to.addEventListener('change', () => { searchTo = to.value; renderArticleTable(); });
  sort.addEventListener('change', () => { searchSort = sort.value; renderArticleTable(); });
}

function clearArticleSearch() {
  searchKeyword = ''; searchFrom = ''; searchTo = ''; searchSort = 'time_desc';
  document.getElementById('articleSearch').value = '';
  document.getElementById('articleFrom').value = '';
  document.getElementById('articleTo').value = '';
  document.getElementById('articleSort').value = 'time_desc';
  renderArticleTable();
}

function addTombstone(ts) {
  if (!ts) return;   // 防御：空值不入墓碑
  window.__GLOG_TOMB__ = window.__GLOG_TOMB__ || [];
  if (window.__GLOG_TOMB__.includes(ts)) return;   // 去重
  window.__GLOG_TOMB__.push(ts);
  if (window.__GLOG_TOMB__.length > 300) window.__GLOG_TOMB__.splice(0, window.__GLOG_TOMB__.length - 300);
}

/* ========================================
   v3.0 · 演示数据（仅本地模式提供）
======================================== */
function loadDemoData() {
  if (!confirm('将载入一套演示数据用于体验各项功能，确认继续？')) return;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const titles = ['新手做公众号的第一个月：从 0 到 500 粉', '我如何用碎片时间完成周更', '排版技巧：让文章有呼吸感的 7 个细节', '涨粉慢？可能是你的定位出了问题', '一次失败的活动复盘', 'AI 辅助写作的正确打开方式', '从阅读量看内容选题的黄金公式', '和读者互动的 5 个小心机', '我的选题库是这样搭建的', '副业写作半年，我收获了什么', '标题打磨的 10 分钟工作流', '如何把一篇长文拆成系列', '公众号数据分析入门指南', '坚持日更 30 天后的变化', '写给想开始写公众号的你', '图文消息的封面设计心得', '用「搜一搜」引流实操记录', '评论区运营的破局思路', '一次小爆款带来的 500 粉', '阶段复盘：那些真正有用的动作'];
  const types = ['article', 'article', 'imgtext', 'article', 'video', 'article', 'imgtext'];
  titles.forEach((t, i) => {
    const d = new Date(now); d.setDate(now.getDate() - Math.floor(i * 6.2) - (i % 3));
    articles.push({ _ts: Date.now() + i, title: t, type: types[i % types.length], datetime: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(9 + (i % 10)) + ':' + pad((i * 17) % 60), original: i % 5 === 0 ? 0 : 1, aiUsage: [0, 1, 1, 0, 2, 1, 0, 2][i % 8] });
  });
  for (let i = 9; i >= 0; i--) {
    const monday = new Date(now); const day = now.getDay() || 7; monday.setDate(now.getDate() - day + 1 - i * 7);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const fm = dt => (dt.getMonth() + 1) + '.' + pad(dt.getDate());
    const base = 2600 + (9 - i) * 420 + (i * 137) % 500;
    weeks.push({ _ts: Date.now() + 1000 + i, _sortTs: monday.getTime(), label: monday.getFullYear() + '年第' + getWeekNumber(monday) + '周', range: fm(monday) + ' – ' + fm(sunday), wdate: monday.getFullYear() + '-' + pad(monday.getMonth() + 1) + '-' + pad(monday.getDate()), reads: base, shares: Math.round(base * 0.035), fans: 1800 + (9 - i) * 65, newfans: 25 + (i * 13) % 40, article: 1 + (i % 3), imgtext: i % 2, video: ((i + 1) % 3 === 0 ? 1 : 0), audio: 0, s1: 18 + i % 7, s2: 32 + i % 9, s3: 12 + i % 5, s4: 7, s5: 16, s6: 6, s7: 5, note: ['这周状态不错，保持节奏。', '推荐流量起来了，选题要跟紧热点。', '老读者互动变多，考虑做个读者群。', '时间管理还需要优化，周更不能断。'][i % 4] });
  }
  Store.persist(); renderOverview(); renderArticleTable(); renderWeekList(); renderTrendLine();
  Store.toast('演示数据已载入，可在各页面查看效果', 'ok');
}

/* ========================================
   BOOT · 数据就绪后启动应用
======================================== */
Store.setDataProvider(function() {
  return { articles: articles, weeks: weeks, avatar: avatar, tombstones: window.__GLOG_TOMB__ || [] };
});

Store.onReady(function(payload, meta) {
  articles = payload.articles || [];
  weeks    = payload.weeks || [];
  avatar   = payload.avatar || '';
  window.__GLOG_TOMB__ = payload.tombstones || [];

  if (avatar) applyAvatar(avatar);
  initAvatarListener();
  renderOverview();
  initSearchBar();

  const demoBtn = document.getElementById('demoDataBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if (meta.mode === 'cloud') {
    if (demoBtn) demoBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
  } else {
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (!articles.length && !weeks.length) {
      setTimeout(() => Store.toast('当前为本地模式：数据仅保存在本设备浏览器'), 700);
    }
  }

  /* PWA：注册 Service Worker（仅 http/https 环境） */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch(function() {});
    /* SW 版本更新接管页面后自动刷新一次，保证用户总是用到最新静态资源 */
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }
});
