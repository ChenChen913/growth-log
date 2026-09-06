/* ════════════════════════════════════════════════════
   公众号成长日志 · 数据卡片导出（Canvas 绘制，从 v2 原样移植）
════════════════════════════════════════════════════ */
/* ========================================
   EXPORT CANVAS (极简淡色液态玻璃风，绝对高清)
======================================== */
function exportCard() {
  const canvas = document.getElementById('cardCanvas');
  const ctx = canvas.getContext('2d');
  const W = 800, H = 660; 
  
  // 重点优化：3倍放大超采样绘制，保证导出的图片完全清晰无锯齿
  const scale = 3;
  canvas.width = W * scale; 
  canvas.height = H * scale;
  ctx.scale(scale, scale);

  // 1. 获取所有所需数据
  const totalReads = weeks.reduce((s,w) => s+(w.reads||0), 0);
  const totalContent = articles.length;
  const originals = articles.filter(a => a.original !== 0).length;

  const typeCounts = { article:0, imgtext:0, video:0, audio:0 };
  const aiCounts = { 0:0, 1:0, 2:0 };
  articles.forEach(a => { 
    if (typeCounts[a.type] !== undefined) typeCounts[a.type]++; 
    aiCounts[a.aiUsage || 0]++;
  });

  // 2. 绘制浅色调背景
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0,   '#f2f7f4');
  bgGrad.addColorStop(0.5, '#ebf3ee');
  bgGrad.addColorStop(1,   '#e3ede7');
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

  // 渲染底层光晕
  const drawOrb = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  };
  drawOrb(150, 150, 300, 'rgba(7, 193, 96, 0.12)');
  drawOrb(650, 500, 350, 'rgba(10, 219, 110, 0.08)');
  drawOrb(700, 100, 250, 'rgba(255, 255, 255, 0.5)');

  // 3. 绘制苹果“液态玻璃”主体卡片
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 15;
  
  // 玻璃渐变
  const glassGrad = ctx.createLinearGradient(40, 40, W-40, H-40);
  glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  glassGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
  glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.75)');
  ctx.fillStyle = glassGrad;
  
  ctx.beginPath();
  if(ctx.roundRect) {
    ctx.roundRect(40, 40, W - 80, H - 80, 28);
  } else {
    ctx.rect(40, 40, W - 80, H - 80);
  }
  ctx.fill();
  ctx.restore();

  // 绘制玻璃高光描边 (模拟厚度与反光)
  ctx.save();
  const strokeGrad = ctx.createLinearGradient(40, 40, W-40, H-40);
  strokeGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  strokeGrad.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
  ctx.strokeStyle = strokeGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(40, 40, W - 80, H - 80, 28); else ctx.rect(40, 40, W - 80, H - 80);
  ctx.stroke();
  ctx.restore();

  // 4. 绘制 Header 元素 (无 Logo 版左对齐排版)
  const titleX = 80;
  const titleY = 110;

  // 标题文字靠左对齐
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1d1d1f'; 
  ctx.font = '600 28px "Noto Serif SC", serif';
  ctx.fillText('公众号数据记录卡片', titleX, titleY);
  
  ctx.fillStyle = '#6b7785'; 
  ctx.font = '400 13px "Noto Sans SC", sans-serif';
  ctx.fillText('Generated · ' + new Date().toLocaleDateString('zh-CN'), titleX, titleY + 28);

  // 分割线
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 175); ctx.lineTo(W - 80, 175); ctx.stroke();

  // 5. 绘制四大核心数据
  const stats =[
    { label: '总计阅读量', value: numFmt(totalReads),   sub: '所有周合计' },
    { label: '已经记录文章', value: String(totalContent), sub: `含原创 ${originals} 篇` },
    { label: '平均每篇阅读', value: totalContent ? numFmt(Math.round(totalReads/totalContent)) : '0', sub: '均集表现' },
    { label: '记录周数',   value: String(weeks.length), sub: '累计完成周报' },
  ];

  const colW = (W - 160) / stats.length;
  stats.forEach((s, i) => {
    const cx = 80 + colW * i + colW / 2;
    const cy = 245;
    ctx.textAlign = 'center';
    ctx.fillStyle = i === 0 ? '#059952' : '#1d1d1f';
    ctx.font = `300 ${i === 0 ? 48 : 40}px "DM Serif Display", serif`;
    ctx.fillText(s.value, cx, cy);
    
    ctx.fillStyle = '#3c424d';
    ctx.font = '300 13px "Noto Sans SC", sans-serif';
    ctx.fillText(s.label, cx, cy + 28);
    
    ctx.fillStyle = '#8492a6';
    ctx.font = '300 12px "Noto Sans SC", sans-serif';
    ctx.fillText(s.sub, cx, cy + 48);
    
    if (i < stats.length - 1) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(80 + colW * (i+1), 200); ctx.lineTo(80 + colW * (i+1), 305); ctx.stroke();
    }
  });

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.beginPath(); ctx.moveTo(80, 340); ctx.lineTo(W - 80, 340); ctx.stroke();

  // 6. 绘制内容类型横向分布条
  ctx.fillStyle = '#3c424d';
  ctx.font = '500 13px "Noto Sans SC", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('各类型文章数量统计', 80, 385);

  const types =['article','imgtext','video','audio'];
  const typeTotal = articles.length || 1;
  const barY = 400, barH = 10, barW = W - 160;
  let bx = 80;
  types.forEach(t => {
    const w = Math.round(typeCounts[t] / typeTotal * barW);
    if (w > 0) {
      ctx.fillStyle = TYPE_FILL[t];
      ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(bx, barY, w, barH, 4); else ctx.rect(bx, barY, w, barH); ctx.fill();
      bx += w;
    }
  });

  let lx = 80;
  types.forEach(t => {
    if (typeCounts[t] === 0) return;
    ctx.fillStyle = TYPE_FILL[t];
    ctx.beginPath(); ctx.arc(lx + 5, 431, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#6b7785';
    ctx.font = '300 12px "Noto Sans SC", sans-serif';
    ctx.fillText(`${TYPE_MAP[t]} ${typeCounts[t]}`, lx + 16, 436);
    lx += ctx.measureText(`${TYPE_MAP[t]} ${typeCounts[t]}`).width + 40;
  });

  // 7. 绘制 AI 统计饼状图 (下半部分)
  ctx.fillStyle = '#3c424d';
  ctx.font = '500 13px "Noto Sans SC", sans-serif';
  ctx.fillText('用户使用 AI 统计占比图', 80, 495);

  const aiTotal = articles.length || 1;
  const pieCx = 145, pieCy = 555, pieR = 45;
  let startAngle = -Math.PI / 2;

  if (articles.length === 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.beginPath(); ctx.arc(pieCx, pieCy, pieR, 0, Math.PI*2); ctx.fill();
  } else {[0, 1, 2].forEach(i => {
      if(aiCounts[i] === 0) return;
      const sliceAngle = (aiCounts[i] / aiTotal) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(pieCx, pieCy);
      ctx.arc(pieCx, pieCy, pieR, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = AI_COLORS[i]; // 淡绿，橘黄，红
      ctx.fill();
      startAngle += sliceAngle;
    });
    // 内圆遮罩，做成高级环形图
    ctx.beginPath();
    ctx.arc(pieCx, pieCy, pieR * 0.58, 0, 2 * Math.PI);
    ctx.fillStyle = '#f9fcf9'; // 配合浅色背景
    ctx.fill();
  }

  // AI 饼图图例
  let legendY = 530;[0, 1, 2].forEach(i => {
    ctx.fillStyle = AI_COLORS[i];
    ctx.beginPath(); ctx.arc(240, legendY - 4, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3c424d';
    ctx.font = '300 14px "Noto Sans SC", sans-serif';
    const pct = articles.length ? Math.round(aiCounts[i]/aiTotal*100) : 0;
    ctx.fillText(`${AI_MAP[i]}  —  ${aiCounts[i]} 篇 (${pct}%)`, 256, legendY + 1);
    legendY += 30;
  });

  // 8. 底部玻璃边界留白与 Watermark
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.font = '300 11px "Noto Sans SC", sans-serif';
  ctx.fillText('公众号成长日志 · 数据可视化', W - 80, H - 65);

  // 确保渲染完成后展示弹窗
  document.getElementById('cardPreviewOverlay').classList.add('show');
}

function downloadCard() {
  const canvas = document.getElementById('cardCanvas');
  const a = document.createElement('a');
  a.download = '公众号数据卡片_' + new Date().toISOString().slice(0,10) + '.png';
  a.href = canvas.toDataURL('image/png'); // 保存高分辨率原图
  a.click();
}

