/**
 * Graph analysis — fetches server-side analysis and renders insights panel.
 * KSA-93 Phase 6: Graph structure insights.
 */

import { emit, on } from './event-bus.js';

const API_URL = 'api/kb/graph/analysis';
const CACHE_KEY = 'kb-viewer-graph-analysis';
const CACHE_TTL = 300000; // 5 minutes
let insightsData = null;

/** Initialize graph analysis (only on graph page). */
export async function initGraphAnalysis() {
  const graphDetail = document.getElementById('graph-detail');
  if (!graphDetail) return;
  insightsData = loadCache();
  if (!insightsData) {
    insightsData = await fetchAnalysis();
    saveCache(insightsData);
  }
  if (insightsData) renderInsights(graphDetail, insightsData);
}

/** Fetch graph analysis from server API. */
async function fetchAnalysis() {
  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    console.debug('[graph-analysis] Fetch failed:', e.message);
    return null;
  }
}

/** Render insights panel into the graph detail sidebar. */
function renderInsights(container, data) {
  if (!data || !data.insights || data.insights.length === 0) return;
  let panel = container.querySelector('.ux-insights-section');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'ux-insights-section';
    panel.style.marginTop = '12px';
    container.appendChild(panel);
  }
  const header = `<h3 style="font-size:.75rem;margin-bottom:6px;opacity:.7">
    🔬 Graph Insights</h3>`;
  const statsHtml = renderStats(data.stats);
  const insightsHtml = data.insights.map(renderInsight).join('');
  panel.innerHTML = header + statsHtml + insightsHtml;
}

/** Render graph stats summary. */
function renderStats(stats) {
  if (!stats) return '';
  return `<div style="font-size:.6rem;opacity:.6;margin-bottom:8px">
    Nodes: ${stats.node_count} | Edges: ${stats.edge_count} | 
    Density: ${(stats.density * 100).toFixed(1)}%
  </div>`;
}

/** Render a single insight item. */
function renderInsight(insight) {
  const icon = getInsightIcon(insight.type);
  const severityColor = getSeverityColor(insight.severity);
  const nodeCount = insight.node_ids ? insight.node_ids.length : 0;
  return `<div class="ux-insight-item">
    <span style="font-size:1rem">${icon}</span>
    <div style="flex:1">
      <div style="font-size:.7rem;font-weight:600;color:${severityColor}">
        ${escText(insight.title)}
      </div>
      <div style="font-size:.6rem;opacity:.7">${escText(insight.description)}</div>
      ${nodeCount > 0 ? `<div style="font-size:.55rem;opacity:.5;margin-top:2px">
        IDs: ${insight.node_ids.slice(0, 5).join(', ')}${nodeCount > 5 ? '...' : ''}
      </div>` : ''}
    </div>
  </div>`;
}

/** Get icon for insight type. */
function getInsightIcon(type) {
  const icons = {
    orphans: '🏝️',
    hubs: '🌟',
    clusters: '🧩',
    stale: '⏰',
  };
  return icons[type] || '📊';
}

/** Get color for severity level. */
function getSeverityColor(severity) {
  const colors = {
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
    error: 'var(--color-error)',
  };
  return colors[severity] || 'var(--color-text-primary)';
}

/** Load cached analysis from localStorage. */
function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    return cached.data;
  } catch { return null; }
}

/** Save analysis to localStorage cache. */
function saveCache(data) {
  if (!data) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data, timestamp: Date.now()
    }));
  } catch { /* quota exceeded */ }
}

/** Escape text for safe display. */
function escText(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export default { initGraphAnalysis };
