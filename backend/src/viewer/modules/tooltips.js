/**
 * Tooltip manager — injects ? icons and manages tooltip popups.
 * KSA-93 Phase 3: Contextual help tooltips.
 */

import { emit } from './event-bus.js';

let config = null;
let activePopup = null;

/** Initialize tooltips for the current page. */
export async function initTooltips(page) {
  try {
    const resp = await fetch('config/tooltips.json');
    if (!resp.ok) return;
    config = await resp.json();
    const pageTooltips = config[page];
    if (pageTooltips) injectTooltips(pageTooltips);
  } catch (e) {
    console.debug('[tooltips] Config load failed:', e.message);
  }
}

/** Inject ? trigger icons next to target elements. */
function injectTooltips(tooltips) {
  for (const tip of tooltips) {
    if (!tip.target) continue;
    const target = document.querySelector(tip.target);
    if (!target) continue;
    if (target.querySelector('.ux-tooltip-trigger')) continue;
    const trigger = createTrigger(tip);
    const computed = getComputedStyle(target).position;
    if (computed === 'static') {
      target.style.position = 'relative';
    }
    target.appendChild(trigger);
  }
}

/** Create a ? trigger button element. */
function createTrigger(tip) {
  const btn = document.createElement('span');
  btn.className = 'ux-tooltip-trigger';
  btn.textContent = '?';
  btn.setAttribute('aria-label', tip.title);
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');
  btn.addEventListener('mouseenter', () => showTooltip(tip, btn));
  btn.addEventListener('mouseleave', () => hideTooltip());
  btn.addEventListener('focus', () => showTooltip(tip, btn));
  btn.addEventListener('blur', () => hideTooltip());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTooltip(tip, btn);
  });
  return btn;
}

/** Show tooltip popup near the trigger element. */
function showTooltip(tip, triggerEl) {
  hideTooltip();
  const popup = document.createElement('div');
  popup.className = 'ux-tooltip-popup';
  popup.innerHTML = `<strong>${escText(tip.title)}</strong><br>${escText(tip.content)}`;
  document.body.appendChild(popup);
  positionPopup(popup, triggerEl);
  requestAnimationFrame(() => popup.classList.add('visible'));
  activePopup = popup;
  emit('tooltip:shown', { id: tip.id });
}

/** Hide active tooltip popup. */
function hideTooltip() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
}

/** Toggle tooltip on click (for mobile/keyboard). */
function toggleTooltip(tip, triggerEl) {
  if (activePopup) {
    hideTooltip();
  } else {
    showTooltip(tip, triggerEl);
  }
}

/** Position popup relative to trigger, avoiding viewport overflow. */
function positionPopup(popup, triggerEl) {
  const triggerRect = triggerEl.getBoundingClientRect();
  const margin = 8;
  let top = triggerRect.bottom + margin;
  let left = triggerRect.left;

  popup.style.top = top + 'px';
  popup.style.left = left + 'px';

  requestAnimationFrame(() => {
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth) {
      left = window.innerWidth - popupRect.width - margin;
    }
    if (popupRect.bottom > window.innerHeight) {
      top = triggerRect.top - popupRect.height - margin;
    }
    popup.style.top = top + 'px';
    popup.style.left = Math.max(margin, left) + 'px';
  });
}

/** Escape text to prevent XSS. */
function escText(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export default { initTooltips };
