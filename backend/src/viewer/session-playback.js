/* Session Playback — play/pause/step/speed controls + keyboard shortcuts */

/** Start or resume playback. */
function replayPlay() {
  if (replayPlaying) { replayPause(); return; }
  replayPlaying = true;
  document.getElementById('replay-play-btn').textContent = '⏸';
  const speed = getPlaybackSpeed();
  replayTimer = setInterval(() => {
    if (replayIdx < replayEvents.length - 1) {
      replayIdx++;
      renderTimeline();
      renderEventDetail();
    } else {
      replayPause();
    }
  }, speed);
}

/** Pause playback. */
function replayPause() {
  replayPlaying = false;
  document.getElementById('replay-play-btn').textContent = '▶';
  if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
}

/** Step forward or backward. */
function replayStep(dir) {
  replayPause();
  replayIdx = Math.max(0, Math.min(replayEvents.length - 1, replayIdx + dir));
  renderTimeline();
  renderEventDetail();
}

/** Jump to specific index. */
function replayJump(idx) {
  replayPause();
  replayIdx = idx;
  renderTimeline();
  renderEventDetail();
}

/** Scrub timeline by click position. */
function replayScrub(ev) {
  const bar = document.getElementById('timeline-track');
  const rect = bar.getBoundingClientRect();
  const pct = (ev.clientX - rect.left) / rect.width;
  replayIdx = Math.floor(pct * (replayEvents.length - 1));
  replayIdx = Math.max(0, Math.min(replayEvents.length - 1, replayIdx));
  renderTimeline();
  renderEventDetail();
}

/** Close replay panel. */
function closeReplay() {
  replayPause();
  document.getElementById('sess-detail').style.display = 'none';
}

/** Get playback speed from selector (ms per step). */
function getPlaybackSpeed() {
  const sel = document.getElementById('replay-speed');
  return sel ? parseInt(sel.value, 10) : 1000;
}

/** Keyboard shortcuts for playback. */
document.addEventListener('keydown', function(ev) {
  const panel = document.getElementById('panel-sessions');
  if (!panel || !panel.classList.contains('active')) return;
  const detail = document.getElementById('sess-detail');
  if (!detail || detail.style.display === 'none') return;
  switch (ev.key) {
    case ' ': ev.preventDefault(); replayPlay(); break;
    case 'ArrowRight': ev.preventDefault(); replayStep(1); break;
    case 'ArrowLeft': ev.preventDefault(); replayStep(-1); break;
    case 'Home': ev.preventDefault(); replayJump(0); break;
    case 'End': ev.preventDefault(); replayJump(replayEvents.length - 1); break;
    case 'Escape': ev.preventDefault(); closeReplay(); break;
  }
});
