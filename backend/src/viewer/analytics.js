/** Analytics page logic — popular queries, zero-result queries, search trends. */
var basePath = window.__MCP_BASE || '';

async function load() {
  try {
    const r = await fetch(basePath + '/api/kb/analytics');
    const d = await r.json();
    renderPopular(d.popular_queries || d.popular || []);
    renderGaps(d.zero_results || d.gaps || []);
    renderTrend(d.search_trend || d.daily_volume || []);
  } catch (e) { console.error(e); }
}

function renderPopular(queries) {
  const el = document.getElementById('popular');
  if (!queries.length) {
    el.innerHTML = '<tr><td colspan="3" class="empty">No data yet</td></tr>';
    return;
  }
  el.innerHTML = queries.slice(0, 15).map(q =>
    `<tr><td>${esc(q.query || q.term || '')}</td>`
    + `<td><span class="badge badge-info">${q.count || 0}</span></td>`
    + `<td>${q.avg_results || q.avgResults || '-'}</td></tr>`
  ).join('');
}

function renderGaps(gaps) {
  const el = document.getElementById('gaps');
  if (!gaps.length) {
    el.innerHTML = '<tr><td colspan="3" class="empty">No gaps detected</td></tr>';
    return;
  }
  el.innerHTML = gaps.slice(0, 15).map(g =>
    `<tr><td>${esc(g.query || g.term || '')}</td>`
    + `<td><span class="badge badge-warn">${g.count || 0}</span></td>`
    + `<td>Gap</td></tr>`
  ).join('');
}

function renderTrend(data) {
  const c = document.getElementById('trend');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  if (!data.length) {
    ctx.fillStyle = '#64748b'; ctx.font = '12px system-ui';
    ctx.fillText('No trend data', 10, 60);
    return;
  }
  const max = Math.max(...data.map(d => d.count || d.value || d), 1);
  const w = c.width / data.length;
  ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.beginPath();
  data.forEach((d, i) => {
    const v = d.count || d.value || d;
    const x = i * w + w / 2;
    const y = c.height - 20 - (v / max) * (c.height - 40);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = 'rgba(56,189,248,0.1)';
  ctx.lineTo((data.length - 1) * w + w / 2, c.height - 20);
  ctx.lineTo(w / 2, c.height - 20);
  ctx.fill();
  data.forEach((d, i) => {
    const v = d.count || d.value || d;
    const x = i * w + w / 2;
    const y = c.height - 20 - (v / max) * (c.height - 40);
    ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.28); ctx.fill();
  });
}

function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

load();
