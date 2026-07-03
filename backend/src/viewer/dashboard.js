/** Dashboard page logic — health gauge, metrics, recommendations, trends. */

async function load() {
  try {
    var basePath = window.__MCP_BASE || '';
    const r = await fetch(basePath + '/api/kb/dashboard');
    const d = await r.json();
    renderGauge(d.health_score || 0);
    renderMetrics(d);
    renderRecs(d.recommendations || []);
    renderTrends(d.trends || {});
  } catch (e) { console.error(e); }
}

function renderGauge(score) {
  const el = document.getElementById('gauge');
  const pct = score / 100;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  el.innerHTML = `<circle cx="60" cy="60" r="50" fill="none" stroke="#334155" stroke-width="10"/>
    <circle cx="60" cy="60" r="50" fill="none" stroke="${color}" stroke-width="10"
      stroke-dasharray="${pct * 314} 314" stroke-linecap="round"
      transform="rotate(-135 60 60)"/>
    <text x="60" y="65" text-anchor="middle" fill="#e2e8f0"
      font-size="20" font-weight="700">${score}</text>`;
  document.getElementById('health-label').textContent =
    score >= 70 ? 'Healthy' : score >= 40 ? 'Needs Attention' : 'Critical';
}

function renderMetrics(d) {
  const m = document.getElementById('metrics');
  const items = [
    { label: 'Total Entries', val: d.total_entries || 0, sub: 'All KB entries' },
    { label: 'Quality Avg', val: (d.quality_avg || 0).toFixed(1), sub: 'Score 0-100' },
    { label: 'Stale', val: d.stale_count || 0, sub: 'Needs review' },
    { label: 'Unowned', val: d.unowned_count || 0, sub: 'No owner assigned' }
  ];
  m.innerHTML = items.map(i => `<div class="card"><h3>${i.label}</h3>
    <div class="val">${i.val}</div><div class="sub">${i.sub}</div></div>`).join('');
}

function renderRecs(recs) {
  const el = document.getElementById('recs');
  // Handle both array and {recommendations: [...]} format
  if (recs && !Array.isArray(recs)) recs = recs.recommendations || [];
  if (!recs) recs = [];
  el.innerHTML = recs.map(r => {
    const msg = r.message || r.action || String(r);
    return `<li class="${r.priority || 'low'}">${msg}</li>`;
  }).join('');
  if (!recs.length) el.innerHTML = '<li class="low">No recommendations</li>';
}

function renderTrends(trends) {
  drawMini('chart-search', trends.search_volume || [], 'Search Volume', '#38bdf8');
  drawMini('chart-ingest', trends.ingest_volume || [], 'Ingest Volume', '#a78bfa');
}

function drawMini(id, data, label, color) {
  const c = document.getElementById(id);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 300, 140);
  ctx.fillStyle = '#94a3b8'; ctx.font = '11px system-ui'; ctx.fillText(label, 8, 16);
  if (!data.length) return;
  const max = Math.max(...data.map(d => d.count || d), 1);
  const w = 280 / data.length;
  data.forEach((d, i) => {
    const v = d.count || d;
    const h = (v / max) * 100;
    ctx.fillStyle = color; ctx.globalAlpha = 0.8;
    ctx.fillRect(10 + i * w, 130 - h, w - 2, h);
  });
  ctx.globalAlpha = 1;
}

async function loadReminders() {
  try {
    var basePath = window.__MCP_BASE || '';
    const r = await fetch(basePath + '/api/kb/reminders');
    const data = await r.json();
    const items = Array.isArray(data) ? data : (data.reminders || data.entries || []);
    const el = document.getElementById('reminders');
    if (!items.length) {
      el.innerHTML = '<tr><td colspan="5" style="padding:.4rem;font-size:.75rem;opacity:.6">No due reviews</td></tr>';
      return;
    }
    el.innerHTML = items.slice(0, 10).map(e => {
      const id = e.id || e.entry_id || '';
      const last = e.last_reviewed_at || e.last_reviewed || 'Never';
      const days = e.days_overdue || e.overdue_days || '—';
      return `<tr><td style="padding:.4rem;border-bottom:1px solid #1e293b">${id}</td>`
        + `<td style="padding:.4rem;border-bottom:1px solid #1e293b">${esc(e.summary || '')}</td>`
        + `<td style="padding:.4rem;border-bottom:1px solid #1e293b">${last}</td>`
        + `<td style="padding:.4rem;border-bottom:1px solid #1e293b;color:#f59e0b">${days}d</td>`
        + `<td style="padding:.4rem;border-bottom:1px solid #1e293b"><button class="btn-review" aria-label="Mark entry ${id} as reviewed" onclick="markReviewed(${id},this,'dashboard')">Mark Reviewed</button></td></tr>`;
    }).join('');
  } catch (e) { console.error(e); }
}

async function markReviewed(entryId, buttonEl, context) {
  buttonEl.disabled = true;
  var originalHTML = buttonEl.innerHTML;
  buttonEl.innerHTML = '<span class="spinner"></span>';

  try {
    var basePath = window.__MCP_BASE || '';
    var r = await fetch(basePath + '/api/kb/entries/' + entryId + '/review', {
      method: 'POST'
    });

    if (!r.ok) {
      var msg = r.status === 404 ? 'Entry not found'
        : r.status === 503 ? 'Service unavailable — please try again later'
        : 'Error: ' + r.status;
      showToast(msg, 'error');
      buttonEl.disabled = false;
      buttonEl.innerHTML = originalHTML;
      return;
    }

    showToast('Entry #' + entryId + ' marked as reviewed', 'success');

    if (context === 'dashboard') {
      var row = buttonEl.closest('tr');
      row.style.transition = 'opacity 300ms ease-out';
      row.style.opacity = '0';
      setTimeout(function() {
        row.remove();
        var tbody = document.getElementById('reminders');
        if (!tbody.children.length) {
          tbody.innerHTML = '<tr><td colspan="5" style="padding:.4rem;font-size:.75rem;opacity:.6">No due reviews</td></tr>';
        }
        decrementStaleCount();
      }, 300);
    } else {
      var badge = document.createElement('span');
      badge.textContent = 'Reviewed \u2713';
      badge.className = 'review-badge';
      buttonEl.replaceWith(badge);
    }
  } catch (err) {
    showToast('Network error — please try again', 'error');
    buttonEl.disabled = false;
    buttonEl.innerHTML = originalHTML;
  }
}

function showToast(message, type) {
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;';
    document.body.appendChild(container);
  }

  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span>' + esc(message) + '</span><span style="cursor:pointer;margin-left:8px;opacity:.7" onclick="this.parentElement.remove()">\u2715</span>';
  toast.style.cssText = 'min-width:250px;max-width:350px;padding:.75rem 1rem;border-radius:.5rem;font-size:.75rem;'
    + 'box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:space-between;'
    + 'opacity:0;transition:opacity 200ms;'
    + (type === 'success'
      ? 'background:#166534;color:#bbf7d0;border-left:4px solid #22c55e;'
      : 'background:#7f1d1d;color:#fecaca;border-left:4px solid #ef4444;');

  container.prepend(toast);
  requestAnimationFrame(function() { toast.style.opacity = '1'; });

  var timeout = type === 'success' ? 3000 : 5000;
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 200);
  }, timeout);
}

function decrementStaleCount() {
  var cards = document.querySelectorAll('#metrics .card');
  cards.forEach(function(card) {
    var label = card.querySelector('h3');
    if (label && label.textContent.trim() === 'Stale') {
      var val = card.querySelector('.val');
      var current = parseInt(val.textContent) || 0;
      if (current > 0) val.textContent = current - 1;
    }
  });
}

function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

load();
loadReminders();
