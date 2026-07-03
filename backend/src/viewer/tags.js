/** Tags page logic — tag cloud, taxonomy tree, search by tag. */
var basePath = window.__MCP_BASE || '';

async function loadPopular() {
  try {
    const r = await fetch(basePath + '/api/kb/tags/popular?limit=30');
    const tags = await r.json();
    const el = document.getElementById('cloud');
    const max = Math.max(...tags.map(t => t.usage_count || 1), 1);
    el.innerHTML = tags.map(t => {
      const size = 0.65 + ((t.usage_count || 1) / max) * 0.8;
      const hue = ((t.tag || '').charCodeAt(0) * 37) % 360;
      return `<span class="tag" style="font-size:${size}rem;`
        + `background:hsla(${hue},60%,40%,0.3);color:hsl(${hue},70%,75%)" `
        + `onclick="searchTag('${esc(t.tag)}')">${esc(t.tag)}`
        + `<small style="opacity:.6;margin-left:.2rem">${t.usage_count || 0}</small></span>`;
    }).join('');
  } catch (e) { console.error(e); }
}

async function loadTaxonomy() {
  try {
    const r = await fetch(basePath + '/api/kb/tags');
    const data = await r.json();
    const el = document.getElementById('tree');
    if (Array.isArray(data) && data.length) {
      el.innerHTML = '<ul>' + data.map(t => renderNode(t)).join('') + '</ul>';
    } else if (data.categories) {
      el.innerHTML = '<ul>' + Object.entries(data.categories).map(([k, v]) =>
        `<li class="parent">${esc(k)}<ul>${v.map(c =>
          `<li onclick="searchTag('${esc(c)}')" style="cursor:pointer">${esc(c)}</li>`
        ).join('')}</ul></li>`).join('') + '</ul>';
    } else {
      el.innerHTML = '<p style="font-size:.75rem;opacity:.6">No taxonomy data</p>';
    }
  } catch (e) { console.error(e); }
}

function renderNode(node) {
  const children = node.children || [];
  return `<li class="${children.length ? 'parent' : ''}" `
    + `onclick="searchTag('${esc(node.tag || node.name || '')}')" style="cursor:pointer">`
    + `${esc(node.tag || node.name || 'unknown')}`
    + (children.length ? '<ul>' + children.map(c => renderNode(c)).join('') + '</ul>' : '')
    + '</li>';
}

async function searchTag(tag) {
  document.getElementById('search-tag').value = tag;
  try {
    const r = await fetch(basePath + '/api/kb/tags/popular?limit=50');
    const all = await r.json();
    const match = all.find(t => t.tag === tag);
    const el = document.getElementById('results');
    if (match && match.entries) {
      el.innerHTML = match.entries.map(e => `<div class="entry">`
        + `<span class="type">${e.type || 'CONTEXT'}</span> `
        + `${esc(e.summary || '')}</div>`).join('');
    } else {
      const sr = await fetch(basePath + '/api/memory/search?q=' + encodeURIComponent(tag));
      const entries = await sr.json();
      el.innerHTML = entries.slice(0, 10).map(e => `<div class="entry">`
        + `<span class="type">${e.type || 'CONTEXT'}</span> `
        + `${esc(e.summary || '')}</div>`).join('') || '<p style="font-size:.75rem">No entries found</p>';
    }
  } catch (e) { console.error(e); }
}

let _acTimer = null;
document.getElementById('search-tag').addEventListener('keyup', function(ev) {
  if (ev.key === 'Enter' && this.value) { searchTag(this.value); hideAC(); return; }
  debounceAC(this.value);
});

function debounceAC(q) {
  clearTimeout(_acTimer);
  if (!q || q.length < 2) { hideAC(); return; }
  _acTimer = setTimeout(() => fetchAC(q), 200);
}

async function fetchAC(q) {
  try {
    const r = await fetch(basePath + '/api/kb/suggestions?q=' + encodeURIComponent(q) + '&limit=8');
    const items = await r.json();
    const el = document.getElementById('ac-list');
    if (!items.length) { hideAC(); return; }
    el.innerHTML = items.map(i => {
      const label = i.summary || i.tag || i.query || String(i);
      return `<div class="ac-item" onclick="pickAC('${esc(label)}')">${esc(label)}</div>`;
    }).join('');
    el.classList.add('show');
  } catch (e) { hideAC(); }
}

function pickAC(val) { document.getElementById('search-tag').value = val; hideAC(); searchTag(val); }
function hideAC() { document.getElementById('ac-list').classList.remove('show'); }
document.addEventListener('click', function(ev) { if (!ev.target.closest('.ac-wrap')) hideAC(); });
function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

loadPopular();
loadTaxonomy();
