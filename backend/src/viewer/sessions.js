/* Sessions Tab — Session list + orchestration (delegates to timeline/playback/export) */
let sessionsData = [];
let replayEvents = [];
let replayIdx = 0;
let replayTimer = null;
let replayPlaying = false;

/** Load sessions from API with filters. */
async function loadSessions() {
  const agent = document.getElementById('sess-agent')?.value || '';
  const status = document.getElementById('sess-status')?.value || '';
  let url = API + '/sessions?limit=50';
  if (agent) url += '&agent=' + encodeURIComponent(agent);
  if (status) url += '&status=' + status;
  try {
    const r = await fetch(url);
    sessionsData = await r.json();
    renderSessionList();
  } catch (e) { console.error('[sessions]', e); }
}

/** Render session list with duration + task count badges. */
function renderSessionList() {
  const el = document.getElementById('sess-list');
  if (!el) return;
  el.innerHTML = sessionsData.map(s => {
    const dur = s.totalDurationMs ? formatDurationShort(s.totalDurationMs) : (s.endedAt ? timeDiff(s.startedAt, s.endedAt) : 'active');
    const tasks = s.taskCount ? '<span style="font-size:.55rem;opacity:.6"> | ' + s.taskCount + ' tasks</span>' : '';
    return '<div class="entry-item" onclick="viewSession(\'' + s.id + '\')">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<span class="entry-type" style="color:#38bdf8">' + (s.agentName || 'unknown') + '</span>' +
      '<span class="badge badge-' + (s.status === 'active' ? 'WORKING' : 'SEMANTIC') + '">' + s.status + '</span></div>' +
      '<div class="entry-summary">' + formatTime(s.startedAt) + ' — ' + dur + tasks + '</div>' +
      '<div class="entry-meta">' + s.observationCount + ' observations</div></div>';
  }).join('') || '<div style="padding:12px;opacity:.5;font-size:.7rem">No sessions found</div>';
}

/** Open session detail and load events. */
async function viewSession(sessionId) {
  document.getElementById('sess-detail').style.display = 'flex';
  document.getElementById('sess-detail-id').textContent = sessionId;
  document.getElementById('timeline-events').innerHTML = '';
  try {
    const r = await fetch(API + '/sessions/' + sessionId + '/events');
    replayEvents = await r.json();
    replayIdx = 0;
    renderTimeline();
    renderEventDetail();
  } catch (e) { console.error('[session-events]', e); }
}

/** Format duration for session list. */
function formatDurationShort(ms) {
  if (ms < 1000) return ms + 'ms';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return sec + 's';
  return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
}

/** Color map for operation types. */
function opColor(op) {
  const map = { INGEST: '#34d399', SEARCH: '#38bdf8', DELETE: '#f87171',
    SESSION_START: '#facc15', SESSION_END: '#94a3b8', CONSOLIDATE: '#a78bfa',
    INGEST_FILE: '#34d399', TOOL_CALL: '#2dd4bf', SYNC_CODE: '#a78bfa',
    INGEST_FILE_SKIP: '#94a3b8', INGEST_FILE_HTTP: '#34d399' };
  return map[op] || '#e2e8f0';
}

/** Load and display a linked knowledge entry. */
async function loadEventEntry(entryId) {
  try {
    const r = await fetch(API + '/entries/' + entryId);
    const e = await r.json();
    const el = document.getElementById('timeline-events');
    const detail = '<div style="background:#0f172a;padding:8px;border-radius:4px;margin:8px 0;border:1px solid #475569">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
      '<b style="color:' + nodeColor(e.type) + ';font-size:.7rem">[' + e.type + '] #' + e.id + '</b>' +
      '<span style="font-size:.6rem;opacity:.6">' + e.tier + '</span></div>' +
      '<div style="font-size:.7rem;margin:4px 0">' + esc(e.summary) + '</div>' +
      (e.content ? '<pre style="font-size:.55rem;white-space:pre-wrap;max-height:150px;overflow-y:auto;background:#1e293b;padding:6px;border-radius:3px;margin-top:4px">' + esc(e.content).substring(0, 500) + '</pre>' : '') +
      '</div>';
    el.insertAdjacentHTML('afterbegin', detail);
  } catch (e) { console.error('[entry]', e); }
}
