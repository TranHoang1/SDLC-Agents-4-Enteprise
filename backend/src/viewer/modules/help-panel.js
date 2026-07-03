/**
 * Help panel — slide-in panel with contextual help content.
 * KSA-93 Phase 7: Contextual help system.
 */

import { on, emit } from './event-bus.js';
import { renderMarkdown } from './markdown-renderer.js';
import { restartTour } from './tour.js';

let panelEl = null;
let currentPage = null;
const CACHE = {};

/** Initialize help panel for the current page. */
export function initHelpPanel(page) {
  currentPage = page;
  createPanel();
  createHelpButton();
  on('help:open', (detail) => openHelp(detail || page));
}

/** Create the slide-in panel element. */
function createPanel() {
  if (document.querySelector('.ux-help-panel')) return;
  panelEl = document.createElement('div');
  panelEl.className = 'ux-help-panel';
  panelEl.innerHTML = `
    <div class="ux-help-header">
      <h3 style="font-size:.8rem;color:var(--color-text-accent)">❓ Trợ giúp</h3>
      <button class="ux-btn help-close" aria-label="Đóng">✕</button>
    </div>
    <div class="ux-help-content">
      <div style="opacity:.5;font-size:.7rem">Đang tải...</div>
    </div>
    <div class="ux-help-footer" style="padding:12px 16px;border-top:1px solid var(--color-border-subtle)">
      <button class="ux-btn help-restart-tour" style="width:100%">🔄 Xem lại Tour hướng dẫn</button>
    </div>`;
  document.body.appendChild(panelEl);
  panelEl.querySelector('.help-close').addEventListener('click', closeHelp);
  panelEl.querySelector('.help-restart-tour').addEventListener('click', () => {
    closeHelp();
    restartTour(currentPage);
  });
}

/** Create floating help button (bottom-right). */
function createHelpButton() {
  if (document.querySelector('.ux-help-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'ux-help-btn';
  btn.innerHTML = '❓';
  btn.setAttribute('aria-label', 'Mở trợ giúp');
  btn.style.cssText = `
    position:fixed;bottom:16px;right:16px;width:40px;height:40px;
    border-radius:50%;border:1px solid var(--color-border);
    background:var(--color-bg-secondary);color:var(--color-text-accent);
    font-size:1.1rem;cursor:pointer;z-index:var(--z-dropdown);
    box-shadow:var(--shadow-md);transition:all var(--transition-fast);
  `;
  btn.addEventListener('click', () => openHelp(currentPage));
  btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.1)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });
  document.body.appendChild(btn);
}

/** Open help panel and load content for section. */
async function openHelp(section) {
  if (!panelEl) return;
  panelEl.classList.add('open');
  const contentEl = panelEl.querySelector('.ux-help-content');
  if (CACHE[section]) {
    contentEl.innerHTML = CACHE[section];
    return;
  }
  contentEl.innerHTML = '<div style="opacity:.5;font-size:.7rem">Đang tải...</div>';
  try {
    const resp = await fetch(`api/kb/help/${section}`);
    if (!resp.ok) {
      contentEl.innerHTML = '<div style="color:var(--color-error)">Không tìm thấy nội dung</div>';
      return;
    }
    const data = await resp.json();
    const html = `<h2 style="font-size:.85rem;margin-bottom:8px;color:var(--color-text-accent)">
      ${escText(data.title)}</h2>${renderMarkdown(data.content)}`;
    CACHE[section] = html;
    contentEl.innerHTML = html;
  } catch (e) {
    contentEl.innerHTML = '<div style="color:var(--color-error)">Lỗi kết nối</div>';
  }
}

/** Close help panel. */
function closeHelp() {
  if (panelEl) panelEl.classList.remove('open');
}

/** Escape text for safe display. */
function escText(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export default { initHelpPanel };
