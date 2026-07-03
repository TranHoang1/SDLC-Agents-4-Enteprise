/* Browser Tab — Advanced entry browsing with filters, pagination, sort */
let browserEntries = [];
let browserOffset = 0;
const BROWSER_PAGE_SIZE = 20;
let browserHasMore = true;

async function loadBrowserEntries(reset) {
  if (reset) { browserOffset = 0; browserEntries = []; browserHasMore = true; }
  const tier = document.getElementById('br-tier')?.value || '';
  const type = document.getElementById('br-type')?.value || '';
  const sort = document.getElementById('br-sort')?.value || 'created_at';
  const search = document.getElementById('br-search')?.value || '';

  let url;
  if (search) {
    url = API + '/search?q=' + encodeURIComponent(search) + '&limit=' + BROWSER_PAGE_SIZE;
    if (tier) url += '&tier=' + tier;
  } else {
    url = API + '/entries?limit=' + BROWSER_PAGE_SIZE + '&offset=' + browserOffset + '&sort=' + sort;
    if (tier) url += '&tier=' + tier;
    if (type) url += '&type=' + type;
  }

  try {
    const r = await fetch(url);
    const data = await r.json();
    if (reset) browserEntries = data;
    else browserEntries = browserEntries.concat(data);
    browserHasMore = data.length >= BROWSER_PAGE_SIZE;
    browserOffset += data.length;
    renderBrowserList();
  } catch (e) { console.error('[browser]', e); }
}

function renderBrowserList() {
  const el = document.getElementById('br-list');
  if (!el) return;
  el.innerHTML = browserEntries.map(e =>
    '<div class="entry-item" onclick="showBrowserDetail(' + e.id + ')">' +
    '<div style="display:flex;justify-content:space-between;align-items:center">' +
    '<span class="entry-type" style="color:' + nodeColor(e.type) + '">' + e.type + '</span>' +
    '<span class="badge badge-' + e.tier + '">' + e.tier + '</span></div>' +
    '<div class="entry-summary">' + esc(e.summary) + '</div>' +
    '<div class="entry-meta">ID:' + e.id + ' | Access:' + e.accessCount +
    ' | Conf:' + (e.confidence || 1).toFixed(2) +
    (e.source ? ' | ' + esc(e.source).substring(0, 30) : '') + '</div></div>'
  ).join('') || '<div style="padding:12px;opacity:.5;font-size:.7rem">No entries found</div>';

  const loadMore = document.getElementById('br-load-more');
  if (loadMore) loadMore.style.display = browserHasMore ? 'block' : 'none';
}

async function showBrowserDetail(id) {
  const panel = document.getElementById('br-detail');
  panel.style.display = 'block';
  try {
    const r = await fetch(API + '/entries/' + id);
    const e = await r.json();
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<b style="font-size:.75rem">Entry #' + e.id + '</b>' +
      '<div style="display:flex;align-items:center;gap:6px">' +
      '<button class="btn-review" aria-label="Mark entry ' + e.id + ' as reviewed" onclick="markReviewed(' + e.id + ',this,\'detail\')">Mark Reviewed</button>' +
      '<span onclick="closeBrowserDetail()" style="cursor:pointer;opacity:.6">\u2715</span></div></div>' +
      renderEntryDetail(e);
  } catch (err) { panel.innerHTML = '<div style="color:#f87171">Error loading entry</div>'; }
}

function closeBrowserDetail() {
  document.getElementById('br-detail').style.display = 'none';
}

function browserLoadMore() {
  loadBrowserEntries(false);
}

function browserSearch(ev) {
  if (ev.key === 'Enter') loadBrowserEntries(true);
}

function browserFilterChange() {
  loadBrowserEntries(true);
}
