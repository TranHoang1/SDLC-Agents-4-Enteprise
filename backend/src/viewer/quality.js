/** Quality page logic — histogram + confidence stats side-by-side, low-quality table, citations. */
var basePath = window.__MCP_BASE || '';

async function loadQuality() {
  try {
    var r = await fetch(basePath + '/api/kb/quality');
    var d = await r.json();
    renderDist(d.distribution || d.score_distribution || {}, d.average_score || d.avg_score || 0);
    renderConfidence(d);
  } catch (e) { console.error(e); }
}

function renderDist(dist, avg) {
  var c = document.getElementById('dist');
  if (!c) return;
  var ctx = c.getContext('2d');
  var buckets = Object.entries(dist).sort(function(a, b) { return a[0] - b[0]; });

  var w = c.parentElement ? c.parentElement.clientWidth - 16 || 380 : 380;
  var h = 160;
  c.width = w;
  c.height = h;
  ctx.clearRect(0, 0, w, h);

  // Title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 12px system-ui';
  ctx.fillText('Quality Distribution (avg: ' + Math.round(avg) + ')', 30, 14);

  if (!buckets.length) {
    ctx.fillStyle = '#64748b';
    ctx.font = '11px system-ui';
    ctx.fillText('No score data', w / 2 - 30, h / 2);
    return;
  }

  var max = Math.max.apply(null, buckets.map(function(b) { return b[1]; }));
  if (max === 0) max = 1;
  var padL = 30, padR = 10, padT = 28, padB = 24;
  var plotW = w - padL - padR;
  var plotH = h - padT - padB;
  var barW = plotW / buckets.length;

  buckets.forEach(function(entry, i) {
    var label = entry[0];
    var count = entry[1];
    var barH = (count / max) * plotH;
    var x = padL + i * barW;
    var y = padT + plotH - barH;
    var score = parseInt(label) || 0;
    var color = score >= 60 ? '#22c55e' : score >= 30 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x + 2, y, barW - 4, barH);
    ctx.globalAlpha = 1;
    // Label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px system-ui';
    ctx.fillText(label, x + barW / 2 - 8, h - 6);
    // Value on top
    if (count > 0) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '9px system-ui';
      ctx.fillText(String(count), x + barW / 2 - 8, y - 4);
    }
  });
}

function renderConfidence(d) {
  var avgEl = document.getElementById('conf-avg');
  var highEl = document.getElementById('conf-high');
  var lowEl = document.getElementById('conf-low');
  if (avgEl) avgEl.textContent = String(d.confidence_avg || d.avg_confidence || 1);
  if (highEl) highEl.textContent = String(d.high_count || d.high_confidence_count || 0);
  if (lowEl) lowEl.textContent = String(d.low_count || d.low_confidence_count || 0);
}

async function loadLow() {
  try {
    var r = await fetch(basePath + '/api/kb/quality/low?threshold=40&limit=20');
    var entries = await r.json();
    var el = document.getElementById('low-table');
    var items = Array.isArray(entries) ? entries : (entries.entries || []);
    if (!items.length) {
      el.innerHTML = '<tr><td colspan="5" style="opacity:.6">No low-quality entries</td></tr>';
      return;
    }
    el.innerHTML = items.map(function(e) {
      var score = e.quality_score || e.score || 0;
      var color = score >= 60 ? '#22c55e' : score >= 30 ? '#f59e0b' : '#ef4444';
      return '<tr><td>' + (e.id || '') + '</td><td>' + (e.type || '') + '</td>'
        + '<td>' + esc(e.summary || '').substring(0, 60) + '</td>'
        + '<td>' + score + '</td>'
        + '<td><div class="score-bar"><div class="score-fill" '
        + 'style="width:' + score + '%;background:' + color + '"></div></div></td></tr>';
    }).join('');
  } catch (e) { console.error(e); }
}

async function loadCited() {
  try {
    var r = await fetch(basePath + '/api/kb/citations/most?limit=10');
    var items = await r.json();
    var el = document.getElementById('cited-table');
    var list = Array.isArray(items) ? items : (items.entries || []);
    if (!list.length) {
      el.innerHTML = '<tr><td colspan="3" style="opacity:.6">No citation data</td></tr>';
      return;
    }
    el.innerHTML = list.map(function(e) {
      return '<tr><td>' + (e.id || e.entry_id || '') + '</td>'
        + '<td>' + esc(e.summary || '') + '</td>'
        + '<td style="color:#38bdf8;font-weight:700">' + (e.citation_count || 0) + '</td></tr>';
    }).join('');
  } catch (e) { console.error(e); }
}

function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

loadQuality();
loadLow();
loadCited();
