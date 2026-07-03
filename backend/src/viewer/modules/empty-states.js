/**
 * Empty state detector and renderer.
 * KSA-93 Phase 4: Shows helpful UI when sections have no data.
 */

import { on } from './event-bus.js';

const EMPTY_CONFIGS = {
  graph: {
    selector: '#graph-recent',
    checkEmpty: (el) => el.textContent.includes('No entries'),
    icon: '🧠',
    title: 'Knowledge Graph trống',
    desc: 'Chưa có entries nào trong KB. Hãy ingest tài liệu hoặc tạo entries mới qua MCP tools.',
    action: { label: 'Xem hướng dẫn', event: 'help:open', detail: 'graph' }
  },
  sessions: {
    selector: '#sess-list',
    checkEmpty: (el) => el.children.length === 0,
    icon: '📋',
    title: 'Chưa có sessions',
    desc: 'Sessions được tạo tự động khi agent thực hiện thao tác trên KB. Hãy chạy agent để bắt đầu.',
    action: null
  },
  browser: {
    selector: '#br-list',
    checkEmpty: (el) => el.children.length === 0,
    icon: '🔍',
    title: 'Không tìm thấy entries',
    desc: 'Thử thay đổi bộ lọc hoặc tìm kiếm với từ khóa khác.',
    action: { label: 'Xóa bộ lọc', event: 'browser:clearFilters' }
  },
  stream: {
    selector: '#stream-list',
    checkEmpty: (el) => el.children.length === 0,
    icon: '⚡',
    title: 'Chưa có events',
    desc: 'Live stream hiển thị events real-time. Events sẽ xuất hiện khi có thao tác trên KB.',
    action: null
  }
};

/** Initialize empty state detection for a page. */
export function initEmptyStates(page) {
  const config = EMPTY_CONFIGS[page];
  if (!config) return;
  checkAndRender(config);
  observeChanges(config);
}

/** Check if section is empty and render empty state. */
function checkAndRender(config) {
  const el = document.querySelector(config.selector);
  if (!el) return;
  setTimeout(() => {
    if (config.checkEmpty(el)) renderEmptyState(el, config);
  }, 1500);
}

/** Render empty state UI inside the target element. */
function renderEmptyState(container, config) {
  if (container.querySelector('.ux-empty-state')) return;
  const emptyEl = document.createElement('div');
  emptyEl.className = 'ux-empty-state';
  emptyEl.innerHTML = buildEmptyHTML(config);
  container.appendChild(emptyEl);
  if (config.action) bindAction(emptyEl, config.action);
}

/** Build empty state HTML. */
function buildEmptyHTML(config) {
  let html = `
    <div class="ux-empty-state-icon">${config.icon}</div>
    <div class="ux-empty-state-title">${escText(config.title)}</div>
    <div class="ux-empty-state-desc">${escText(config.desc)}</div>`;
  if (config.action) {
    html += `<div class="ux-empty-state-action">
      <button class="ux-btn ux-btn-primary empty-action">${escText(config.action.label)}</button>
    </div>`;
  }
  return html;
}

/** Bind action button click to event bus. */
function bindAction(el, action) {
  const btn = el.querySelector('.empty-action');
  if (!btn) return;
  const { emit } = await_import_event_bus();
  btn.addEventListener('click', () => {
    import('./event-bus.js').then(bus => {
      bus.emit(action.event, action.detail);
    });
  });
}

/** Use MutationObserver to remove empty state when content appears. */
function observeChanges(config) {
  const el = document.querySelector(config.selector);
  if (!el) return;
  const observer = new MutationObserver(() => {
    const emptyState = el.querySelector('.ux-empty-state');
    if (!emptyState) return;
    const hasRealContent = Array.from(el.children).some(
      child => !child.classList.contains('ux-empty-state')
    );
    if (hasRealContent) emptyState.remove();
  });
  observer.observe(el, { childList: true });
}

/** Lazy import helper (avoids circular deps). */
function await_import_event_bus() {
  return { emit: (e, d) => document.dispatchEvent(new CustomEvent('ux:' + e, { detail: d })) };
}

/** Escape text for safe display. */
function escText(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export default { initEmptyStates };
