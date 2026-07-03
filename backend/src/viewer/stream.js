/* Stream Tab — Live Operations Stream via audit log polling */
let streamEvents = [];
let streamLastId = 0;
let streamPaused = false;
let streamTimer = null;
let streamSortAsc = false;
const STREAM_MAX = 100;
const STREAM_INTERVAL = 3000;

function startStream() {
  if (streamTimer) return;
  streamTimer = setInterval(pollStream, STREAM_INTERVAL);
  pollStream();
}

function stopStream() {
  if (streamTimer) { clearInterval(streamTimer); streamTimer = null; }
}

async function pollStream() {
  if (streamPaused) return;
  try {
    const url = API + '/audit?limit=20' + (streamLastId ? '&after_id=' + streamLastId : '') + '&exclude=SESSION_START,SESSION_END';
    const r = await fetch(url);
    const data = await r.json();
    if (!data.length) return;

    const newEvents = data.filter(e => e.id > streamLastId);
    if (!newEvents.length) return;

    streamLastId = Math.max(...newEvents.map(e => e.id));
    streamEvents = newEvents.reverse().concat(streamEvents).slice(0, STREAM_MAX);
    renderStream();
    flashIndicator();
  } catch (e) { console.error('[stream]', e); }
}

function renderStream() {
  const el = document.getElementById('stream-list');
  if (!el) return;
  const sorted = streamSortAsc ? [...streamEvents].reverse() : streamEvents;
  el.innerHTML = sorted.map((e, i) =>
    '<div class="stream-item" onclick="showStreamDetail(' + i + ')" style="cursor:pointer">' +
    '<div class="stream-time">' + formatTime(e.createdAt || '') + '</div>' +
    '<div style="display:flex;gap:6px;align-items:center">' +
    '<span class="entry-type" style="color:' + opColor(e.operation) + '">' + e.operation + '</span>' +
    (e.sessionId ? '<span class="entry-meta">session:' + e.sessionId.substring(0, 8) + '</span>' : '') +
    '</div>' +
    (e.details ? '<div class="entry-summary">' + esc(e.details) + '</div>' : '') +
    (e.entryId ? '<div class="entry-meta">Entry #' + e.entryId + '</div>' : '') +
    '</div>'
  ).join('') || '<div style="padding:12px;opacity:.5;font-size:.7rem">Waiting for operations...</div>';

  if (!streamPaused) el.scrollTop = 0;
}

function showStreamDetail(idx) {
  const sorted = streamSortAsc ? [...streamEvents].reverse() : streamEvents;
  const e = sorted[idx];
  if (!e) return;
  const panel = document.getElementById('stream-detail');
  const content = document.getElementById('stream-detail-content');
  panel.style.display = 'block';
  content.innerHTML =
    '<div style="margin-bottom:8px"><span class="entry-type" style="color:' + opColor(e.operation) + ';font-size:.8rem">' + e.operation + '</span></div>' +
    '<div style="font-size:.65rem;opacity:.7;margin-bottom:6px">' + formatTime(e.createdAt) + '</div>' +
    '<div style="font-size:.65rem;margin-bottom:6px">ID: ' + e.id + '</div>' +
    (e.sessionId ? '<div style="font-size:.65rem;margin-bottom:6px">Session: ' + e.sessionId + '</div>' : '') +
    (e.entryId ? '<div style="font-size:.65rem;margin-bottom:6px">Entry: #' + e.entryId + '</div>' : '') +
    (e.details ? '<div style="margin-top:8px;font-size:.65rem;font-weight:600">Details:</div><pre style="font-size:.6rem;white-space:pre-wrap;background:#0f172a;padding:8px;border-radius:4px;margin-top:4px;max-height:300px;overflow-y:auto">' + esc(e.details) + '</pre>' : '<div style="opacity:.5;font-size:.65rem;margin-top:8px">No details</div>');
}

function closeStreamDetail() {
  document.getElementById('stream-detail').style.display = 'none';
}

function opColor(op) {
  const map = { INGEST: '#34d399', INGEST_FILE: '#34d399', SEARCH: '#38bdf8',
    DELETE: '#f87171', ACCESS: '#facc15', SESSION_START: '#a78bfa',
    SESSION_END: '#94a3b8', CONSOLIDATE: '#fb923c', SYNC_CODE: '#f472b6',
    TOOL_CALL: '#38bdf8' };
  return map[op] || '#e2e8f0';
}

function toggleStreamPause() {
  streamPaused = !streamPaused;
  const btn = document.getElementById('stream-pause-btn');
  if (btn) btn.textContent = streamPaused ? '▶ Resume' : '⏸ Pause';
}

function toggleStreamSort() {
  streamSortAsc = !streamSortAsc;
  const btn = document.getElementById('stream-sort-btn');
  if (btn) btn.textContent = streamSortAsc ? '↓ Newest first' : '↑ Oldest first';
  renderStream();
}

function flashIndicator() {
  const dot = document.getElementById('stream-indicator');
  if (!dot) return;
  dot.classList.add('flash');
  setTimeout(() => dot.classList.remove('flash'), 600);
}

function clearStream() {
  streamEvents = [];
  streamLastId = 0;
  renderStream();
}
