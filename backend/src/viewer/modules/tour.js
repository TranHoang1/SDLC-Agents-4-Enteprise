/**
 * Onboarding tour engine — manages state, step navigation, persistence.
 * KSA-93 Phase 2: Tour system.
 */

import { emit } from './event-bus.js';
import { renderTourUI, destroyTourUI } from './tour-ui.js';

const STORAGE_KEY = 'kb-viewer-tour-completed';
let currentTour = null;

/** Check if tour was already completed for this page. */
function isCompleted(page) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return data[page] === true;
  } catch { return false; }
}

/** Mark tour as completed for a page. */
function markCompleted(page) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data[page] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* localStorage unavailable */ }
}

/** Start tour for a page. */
export function startTour(page, steps) {
  if (!steps || steps.length === 0) return;
  currentTour = { page, steps, currentStep: 0 };
  emit('tour:started', { page });
  renderTourUI(currentTour, { next: nextStep, prev: prevStep, dismiss });
}

/** Advance to next step. */
function nextStep() {
  if (!currentTour) return;
  currentTour.currentStep++;
  if (currentTour.currentStep >= currentTour.steps.length) {
    completeTour();
    return;
  }
  emit('tour:step', { step: currentTour.currentStep });
  renderTourUI(currentTour, { next: nextStep, prev: prevStep, dismiss });
}

/** Go back one step. */
function prevStep() {
  if (!currentTour || currentTour.currentStep <= 0) return;
  currentTour.currentStep--;
  emit('tour:step', { step: currentTour.currentStep });
  renderTourUI(currentTour, { next: nextStep, prev: prevStep, dismiss });
}

/** Dismiss/skip tour. */
function dismiss() {
  if (!currentTour) return;
  markCompleted(currentTour.page);
  emit('tour:dismissed', { page: currentTour.page });
  destroyTourUI();
  currentTour = null;
}

/** Complete tour (reached end). */
function completeTour() {
  if (!currentTour) return;
  markCompleted(currentTour.page);
  emit('tour:completed', { page: currentTour.page });
  destroyTourUI();
  currentTour = null;
}

/** Restart tour for a page (from help menu). */
export function restartTour(page) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete data[page];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
  initTour(page);
}

/** Initialize tour — loads config and starts if first visit. */
export async function initTour(page) {
  if (isCompleted(page)) return;
  try {
    const resp = await fetch('config/tour-steps.json');
    if (!resp.ok) return;
    const config = await resp.json();
    const steps = config[page];
    if (steps && steps.length > 0) startTour(page, steps);
  } catch (e) {
    console.debug('[tour] Config load failed:', e.message);
  }
}

export default { initTour, restartTour, startTour };
