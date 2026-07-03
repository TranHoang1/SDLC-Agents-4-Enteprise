/**
 * Tour UI rendering — DOM manipulation for tour overlay, spotlight, cards.
 * KSA-93 Phase 2: Tour visual layer.
 */

let overlayEl = null;
let cardEl = null;

/** Render tour UI for current step. */
export function renderTourUI(tour, actions) {
  const step = tour.steps[tour.currentStep];
  if (!step) return;
  destroyTourUI();
  createOverlay(actions);
  createCard(step, tour, actions);
  if (step.target) highlightTarget(step.target);
}

/** Remove all tour UI elements. */
export function destroyTourUI() {
  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  if (cardEl) { cardEl.remove(); cardEl = null; }
}

/** Create dark overlay background. */
function createOverlay(actions) {
  overlayEl = document.createElement('div');
  overlayEl.className = 'ux-tour-overlay';
  overlayEl.addEventListener('click', actions.dismiss);
  document.body.appendChild(overlayEl);
}

/** Create tour step card with content and navigation. */
function createCard(step, tour, actions) {
  cardEl = document.createElement('div');
  cardEl.className = 'ux-tour-card';
  const total = tour.steps.length;
  const current = tour.currentStep;

  cardEl.innerHTML = buildCardHTML(step, current, total);
  document.body.appendChild(cardEl);

  bindCardEvents(cardEl, actions, current, total);
  positionCard(step);
}

/** Build card inner HTML. */
function buildCardHTML(step, current, total) {
  const dots = Array.from({ length: total }, (_, i) =>
    `<span class="ux-tour-dot${i === current ? ' active' : ''}"></span>`
  ).join('');

  return `
    <h3>${escText(step.title)}</h3>
    <p>${escText(step.content)}</p>
    <div class="ux-tour-nav">
      <button class="ux-btn tour-skip">Bỏ qua</button>
      <div class="ux-tour-dots">${dots}</div>
      <div>
        ${current > 0 ? '<button class="ux-btn tour-prev">← Trước</button> ' : ''}
        <button class="ux-btn ux-btn-primary tour-next">
          ${current === total - 1 ? 'Hoàn tất ✓' : 'Tiếp →'}
        </button>
      </div>
    </div>`;
}

/** Bind click events to card buttons. */
function bindCardEvents(card, actions, current, total) {
  card.querySelector('.tour-skip')?.addEventListener('click', actions.dismiss);
  card.querySelector('.tour-next')?.addEventListener('click', actions.next);
  if (current > 0) {
    card.querySelector('.tour-prev')?.addEventListener('click', actions.prev);
  }
}

/** Position card relative to target element or center. */
function positionCard(step) {
  if (!cardEl) return;
  if (!step.target || step.position === 'center') {
    cardEl.style.top = '50%';
    cardEl.style.left = '50%';
    cardEl.style.transform = 'translate(-50%, -50%)';
    return;
  }
  const target = document.querySelector(step.target);
  if (!target) {
    cardEl.style.top = '50%';
    cardEl.style.left = '50%';
    cardEl.style.transform = 'translate(-50%, -50%)';
    return;
  }
  const rect = target.getBoundingClientRect();
  const pos = calcPosition(rect, step.position);
  cardEl.style.top = pos.top + 'px';
  cardEl.style.left = pos.left + 'px';
}

/** Calculate card position based on target rect and preferred position. */
function calcPosition(rect, position) {
  const margin = 12;
  switch (position) {
    case 'bottom':
      return { top: rect.bottom + margin, left: rect.left };
    case 'top':
      return { top: rect.top - margin - 160, left: rect.left };
    case 'left':
      return { top: rect.top, left: rect.left - 340 };
    case 'right':
      return { top: rect.top, left: rect.right + margin };
    default:
      return { top: rect.bottom + margin, left: rect.left };
  }
}

/** Highlight target element with spotlight effect. */
function highlightTarget(selector) {
  const target = document.querySelector(selector);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const spotlight = document.createElement('div');
  spotlight.className = 'ux-tour-spotlight';
  spotlight.style.top = (rect.top - 4) + 'px';
  spotlight.style.left = (rect.left - 4) + 'px';
  spotlight.style.width = (rect.width + 8) + 'px';
  spotlight.style.height = (rect.height + 8) + 'px';
  document.body.appendChild(spotlight);
  if (overlayEl) overlayEl.appendChild(spotlight);
}

/** Escape text for safe insertion (no innerHTML XSS). */
function escText(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
