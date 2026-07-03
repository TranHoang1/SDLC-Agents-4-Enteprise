/* Session Timeline — task grouping + duration badges + event cards */

/** Render timeline with task groups. */
function renderTimeline() {
  const bar = document.getElementById('timeline-bar');
  const total = replayEvents.length || 1;
  bar.style.width = ((replayIdx + 1) / total * 100) + '%';
  document.getElementById('timeline-pos').textContent =
    (replayIdx + 1) + '/' + replayEvents.length;
}

/** Render event detail panel with task grouping. */
function renderEventDetail() {
  const el = document.getElementById('timeline-events');
  if (!replayEvents.length) {
    el.innerHTML = '<div style="opacity:.5;font-size:.7rem">No events</div>';
    return;
  }
  const listEl = el.querySelector('#replay-list');
  if (!listEl) {
    el.innerHTML = '<div id="replay-detail" style="margin-bottom:8px"></div>' +
      '<div id="replay-list" style="max-height:400px;overflow-y:auto">' +
      buildGroupedList() + '</div>';
  }
  updateDetailCard();
  highlightActiveRow();
}

/** Build event list HTML grouped by taskId. */
function buildGroupedList() {
  const groups = groupByTask(replayEvents);
  let html = '';
  for (const group of groups) {
    if (group.taskId) {
      html += '<div class="task-group" style="margin:4px 0;border-left:2px solid #a78bfa;padding-left:4px">' +
        '<div style="font-size:.6rem;color:#a78bfa;margin-bottom:2px">⚡ ' + group.taskId + '</div>';
    }
    for (const ev of group.events) {
      html += buildEventRow(ev);
    }
    if (group.taskId) html += '</div>';
  }
  return html;
}

/** Group events by taskId, preserving order. */
function groupByTask(events) {
  const groups = [];
  let current = { taskId: events[0]?.taskId || null, events: [] };
  for (const ev of events) {
    const tid = ev.taskId || null;
    if (tid !== current.taskId) {
      if (current.events.length) groups.push(current);
      current = { taskId: tid, events: [] };
    }
    current.events.push(ev);
  }
  if (current.events.length) groups.push(current);
  return groups;
}

/** Build a single event row with duration badge. */
function buildEventRow(ev) {
  const idx = replayEvents.indexOf(ev);
  const dur = ev.durationMs ? formatDurationBadge(ev.durationMs) : '';
  const tool = ev.toolName ? '<span style="font-size:.55rem;color:#94a3b8"> ' + ev.toolName + '</span>' : '';
  return '<div class="entry-item replay-row" data-idx="' + idx + '" ' +
    'style="padding:4px 6px;cursor:pointer" onclick="replayJump(' + idx + ')">' +
    '<span style="font-size:.6rem;color:' + opColor(ev.operation) + '">' + ev.operation + '</span>' +
    tool + dur +
    '<span style="font-size:.55rem;opacity:.5;float:right">' + (idx + 1) + '</span></div>';
}

/** Format duration as colored badge. */
function formatDurationBadge(ms) {
  const color = ms > 1000 ? '#f87171' : ms > 200 ? '#facc15' : '#34d399';
  const text = ms > 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms';
  return ' <span style="font-size:.5rem;background:' + color + '20;color:' + color +
    ';padding:1px 3px;border-radius:2px">' + text + '</span>';
}

/** Update the detail card for current event. */
function updateDetailCard() {
  const cur = replayEvents[replayIdx];
  const detailEl = document.getElementById('replay-detail');
  if (!detailEl || !cur) return;
  const args = cur.arguments ? '<details style="margin-top:4px"><summary style="font-size:.6rem;cursor:pointer;color:#94a3b8">Arguments</summary>' +
    '<pre style="font-size:.55rem;white-space:pre-wrap;max-height:100px;overflow-y:auto;background:#0f172a;padding:4px;border-radius:3px;margin-top:2px">' +
    esc(cur.arguments).substring(0, 500) + '</pre></details>' : '';
  const result = cur.resultSummary ? '<div style="font-size:.65rem;color:#34d399;margin-top:4px">→ ' + esc(cur.resultSummary).substring(0, 150) + '</div>' : '';
  detailEl.innerHTML = '<div style="background:#1e293b;padding:8px;border-radius:4px;border-left:3px solid #38bdf8">' +
    '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
    '<b style="color:' + opColor(cur.operation) + ';font-size:.75rem">' + cur.operation + '</b>' +
    '<span style="font-size:.6rem;opacity:.6">' + formatTime(cur.createdAt) + '</span></div>' +
    (cur.toolName ? '<div style="font-size:.65rem;color:#38bdf8;margin-bottom:2px">🔧 ' + cur.toolName + '</div>' : '') +
    (cur.durationMs ? '<div style="font-size:.65rem;opacity:.7">⏱ ' + cur.durationMs + 'ms</div>' : '') +
    (cur.details ? '<div style="font-size:.7rem;margin:4px 0;line-height:1.4;word-break:break-all">' + esc(cur.details) + '</div>' : '') +
    result + args +
    (cur.entryId ? '<div style="font-size:.65rem;opacity:.7;margin-top:4px">Entry #' + cur.entryId + ' <a style="color:#38bdf8;cursor:pointer" onclick="loadEventEntry(' + cur.entryId + ')">[view]</a></div>' : '') +
    '</div>';
}

/** Highlight active row without rebuilding list. */
function highlightActiveRow() {
  const el = document.getElementById('timeline-events');
  const rows = el.querySelectorAll('.replay-row');
  rows.forEach((row, i) => {
    row.style.background = i === replayIdx ? '#1e3a5f' : '';
  });
  const activeRow = rows[replayIdx];
  if (activeRow) activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
