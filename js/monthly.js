/* ═══════════════════════════════════════════════════════════════
   公众号成长日志 · 月度 / 年度汇总
   ───────────────────────────────────────────────────────────────
   · 指标归属：周报数据按"周起始日期(wdate)"归入月份
              文章记录按"发布时间(datetime)"归入月份
   · 年度英雄卡：年总阅读 / 年总分享 / 年新增粉丝 / 年内容数
   · 月度趋势图：单指标 12 个月柱状图（可切换指标）
   · 月度卡片：各月四项指标 + 阅读量环比
   ═══════════════════════════════════════════════════════════════ */

let monthYear = null;        // 当前查看的年份
let monthMetric = 'reads';
let monthChartInst = null;

const MONTH_METRIC_META = {
  reads:   { label: '阅读量',  color: '#07C160' },
  shares:  { label: '分享数',  color: '#e8a838' },
  newfans: { label: '新增粉丝', color: '#5b9bd5' },
  content: { label: '内容数',  color: '#9b6dd6' }
};

/* 数据 → { 'YYYY': {...}, } 与 { 'YYYY-MM': {...} } 聚合 */
function buildMonthAgg() {
  const years = new Set();
  const byMonth = {};   // 'YYYY-MM' -> { reads, shares, newfans, fansLast, content, posts }

  const touch = key => {
    if (!byMonth[key]) byMonth[key] = { reads: 0, shares: 0, newfans: 0, fansLast: null, content: 0, posts: 0 };
    const yy = parseInt(key.slice(0, 4), 10); if (yy >= 2000 && yy <= 2100) years.add(String(yy));   // 年份强制数字，防注入
    return byMonth[key];
  };

  (typeof weeks !== "undefined" ? weeks : []).forEach(w => {
    const d = w.wdate || (w._sortTs ? new Date(w._sortTs).toISOString().slice(0, 10) : '');
    if (!d || d.length < 7) return;
    const key = d.slice(0, 7);
    const m = touch(key);
    m.reads   += w.reads || 0;
    m.shares  += w.shares || 0;
    m.newfans += w.newfans || 0;
    if (w.fans != null && w.fans !== '') m.fansLast = w.fans;
    m.content += (w.article || 0) + (w.imgtext || 0) + (w.video || 0) + (w.audio || 0);
  });

  (typeof articles !== "undefined" ? articles : []).forEach(a => {
    if (!a.datetime || a.datetime.length < 7) return;
    const key = a.datetime.slice(0, 7);
    const m = touch(key);
    m.posts += 1;
  });

  return { years: [...years].sort().reverse(), byMonth };
}

function monthKeyList(year) {
  const list = [];
  for (let i = 1; i <= 12; i++) list.push(year + '-' + String(i).padStart(2, '0'));
  return list;
}

function setMonthMetric(m, btn) {
  monthMetric = m;
  document.querySelectorAll('#monthMetricGroup .ctrl-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMonthChart();
}

function renderMonthChart() {
  if (!monthYear) return;
  const { byMonth } = buildMonthAgg();
  const canvas = document.getElementById('monthChart');
  if (!canvas) return;
  const meta = MONTH_METRIC_META[monthMetric];
  const values = monthKeyList(monthYear).map(k => {
    const m = byMonth[k];
    if (!m) return 0;
    return monthMetric === 'content' ? m.content : m[monthMetric];
  });
  if (monthChartInst) monthChartInst.destroy();
  if (values.every(v => !v)) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const hexToRgba = (hex, a) => `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
  const grad = ctx.createLinearGradient(0, 0, 0, 300);
  grad.addColorStop(0, hexToRgba(meta.color, 0.85));
  grad.addColorStop(1, hexToRgba(meta.color, 0.45));
  monthChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
      datasets: [{ label: meta.label, data: values, backgroundColor: grad, borderRadius: 8, maxBarThickness: 42 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(28,33,40,0.88)', padding: 12 } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
    }
  });
}

function renderYearHero(year, byMonth) {
  const hero = document.getElementById('yearHero');
  let reads = 0, shares = 0, newfans = 0, content = 0, posts = 0;
  monthKeyList(year).forEach(k => {
    const m = byMonth[k]; if (!m) return;
    reads += m.reads; shares += m.shares; newfans += m.newfans; content += m.content; posts += m.posts;
  });
  hero.innerHTML = `
    <div class="stat-hero-card accent"><div class="stat-label">${year} 年总阅读</div><div class="stat-value">${numFmt(reads)}</div><div class="stat-sub">按周报合计</div></div>
    <div class="stat-hero-card"><div class="stat-label">年总分享</div><div class="stat-value">${numFmt(shares)}</div><div class="stat-sub">次分享</div></div>
    <div class="stat-hero-card"><div class="stat-label">年新增粉丝</div><div class="stat-value">${numFmt(newfans)}</div><div class="stat-sub">净增长</div></div>
    <div class="stat-hero-card"><div class="stat-label">年内容发布</div><div class="stat-value">${content}</div><div class="stat-sub">篇周报内容 · ${posts} 条记录</div></div>`;
}

function renderMonthGrid(year, byMonth) {
  const grid = document.getElementById('monthGrid');
  const keys = monthKeyList(year);
  let prevReads = null;
  const nowKey = new Date().toISOString().slice(0, 7);

  const cards = keys.map((k, idx) => {
    const m = byMonth[k];
    const monthNo = idx + 1;
    if (!m) { prevReads = prevReads; return `
      <div class="month-card month-card-empty">
        <div class="month-card-head"><span class="month-name">${monthNo} 月</span></div>
        <div class="month-rows"><div class="month-none">本月无记录</div></div>
      </div>`; }
    let deltaHtml = '';
    if (prevReads !== null && prevReads > 0) {
      const diff = Math.round((m.reads - prevReads) / prevReads * 100);
      if (diff > 0) deltaHtml = `<span class="month-delta up">▲ ${diff}%</span>`;
      else if (diff < 0) deltaHtml = `<span class="month-delta down">▼ ${Math.abs(diff)}%</span>`;
      else deltaHtml = `<span class="month-delta">— 持平</span>`;
    }
    prevReads = m.reads;
    const isCurrent = k === nowKey ? '<span class="month-now">本月</span>' : '';
    return `
      <div class="month-card">
        <div class="month-card-head"><span class="month-name">${monthNo} 月 ${isCurrent}</span>${deltaHtml}</div>
        <div class="month-rows">
          <div class="mrow"><span>阅读量</span><b>${numFmt(m.reads)}</b></div>
          <div class="mrow"><span>分享数</span><b>${numFmt(m.shares)}</b></div>
          <div class="mrow"><span>新增粉丝</span><b class="${m.newfans < 0 ? 'neg' : 'pos'}">${m.newfans > 0 ? '+' : ''}${numFmt(m.newfans)}</b></div>
          <div class="mrow"><span>周报内容</span><b>${m.content} 篇</b></div>
          <div class="mrow"><span>记录文章</span><b>${m.posts} 条</b></div>
        </div>
      </div>`;
  }).join('');

  const hasData = keys.some(k => byMonth[k]);
  grid.innerHTML = hasData ? cards : `<div class="empty-tip" style="grid-column:1/-1;"><strong>暂无月度数据</strong>记录周报或文章后，这里会自动生成月度报表</div>`;
}

function renderMonthly() {
  const { years, byMonth } = buildMonthAgg();

  /* 年份切换 chips */
  const chips = document.getElementById('yearChips');
  if (years.length === 0) {
    chips.innerHTML = `<span class="year-chip active">${new Date().getFullYear()}</span>`;
    monthYear = String(new Date().getFullYear());
  } else {
    if (!monthYear || !years.includes(monthYear)) monthYear = years[0];
    chips.innerHTML = years.map(y =>
      `<button class="year-chip ${y === monthYear ? 'active' : ''}" onclick="switchMonthYear('${y}', this)">${y}</button>`
    ).join('');
  }

  renderYearHero(monthYear, byMonth);
  renderMonthChart();
  renderMonthGrid(monthYear, byMonth);
}

function switchMonthYear(y, el) {
  monthYear = y;
  document.querySelectorAll('.year-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const { byMonth } = buildMonthAgg();
  renderYearHero(y, byMonth);
  renderMonthChart();
  renderMonthGrid(y, byMonth);
}
