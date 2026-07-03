/**
 * Recommendation panel — fetches and displays KB improvement suggestions.
 * KSA-93 Phase 5: Actionable recommendations with Fix Now buttons.
 */

import { emit, on } from './event-bus.js';

const API_URL = 'api/kb/recommendations';
const CACHE_TTL = 30000; // 30 seconds
let lastFetch = 0;
let cachedData = null;
let containerEl = null;

/** Initialize recommendations (only on pages with graph-detail panel). */
export async function initRecommendations() {
  containerEl = document.getElementById('graph-detail');
  if (!containerEl) return;
  await loadAndRender();
  on('recommendation:refresh', loadAndRender);
}

/** Fetch recommendations from API and render. */
async function loadAndRender() {
  const now = Date.now();
  if (cachedData && (now - lastFetch) < CACHE_TTL) {
    render(cachedData);
    return;
  }
  try {
    const resp = await fetch(API_URL + '?limit=5');
    if (!resp.ok) return;
    cachedData = await resp.json();
    lastFetch = now;
    render(cachedData);
  } catch (e) {
    console.debug('[recommendations] Fetch failed:', e.message);
  }
}

/** Render recommendation cards into the container. */
function render(data) {
  if (!containerEl || !data.recommendations) return;
  let section = containerEl.querySelector('.ux-rec-section');
  if (!section) {
    section = document.createElement('div');
    section.className = 'ux-rec-section';
    section.style.marginTop = '12px';
    containerEl.appendChild(section);
  }
  if (data.recommendations.length === 0) {
    section.innerHTML = '<div style="font-size:.65rem;opacity:.5">✅ Không có recommendations</div>';
    return;
  }
  const header = `<h3 style="font-size:.75rem;margin-bottom:6px;opacity:.7">
    💡 Recommendations (${data.total})</h3>`;
  const cards = data.recommendations.map(buildCard).join('');
  section.innerHTML = header + cards;
  bindActions(section);
}

/** Build HTML for a single recommendation card. */
function buildCard(rec) {
  const severityClass = `severity-${rec.severity}`;
  const actionBtn = rec.action
    ? `<button class="ux-btn rec-action" data-endpoint="${rec.action.endpoint}" 
         data-method="${rec.action.method}">${escText(rec.action.label)}</button>`
    : '';
  return `<div class="ux-rec-card ${severityClass}" data-id="${rec.id}">
    <div style="font-size:.7rem;font-weight:600;margin-bottom:2px">${escText(rec.title)}</div>
    <div style="font-size:.6rem;opacity:.7;margin-bottom:4px">${escText(rec.description)}</div>
    ${actionBtn}
  </div>`;
}

/** Bind click handlers to Fix Now action buttons. */
function bindActions(section) {
  section.querySelectorAll('.rec-action').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const endpoint = btn.dataset.endpoint;
      const method = btn.dataset.method || 'POST';
      await executeAction(endpoint, method, btn);
    });
  });
}

/** Execute a recommendation action (POST to endpoint). */
async function executeAction(endpoint, method, btn) {
  btn.disabled = true;
  btn.textContent = '⏳...';
  try {
    const resp = await fetch(endpoint, { method });
    if (resp.ok) {
      btn.textContent = '✓ Done';
      btn.style.background = 'var(--color-success)';
      btn.style.color = '#000';
      cachedData = null;
      setTimeout(() => emit('recommendation:refresh'), 1500);
    } else {
      btn.textContent = '✗ Error';
      btn.disabled = false;
    }
  } catch {
    btn.textContent = '✗ Network error';
    btn.disabled = false;
  }
}

/** Escape text for safe display. */
function escText(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export default { initRecommendations };
