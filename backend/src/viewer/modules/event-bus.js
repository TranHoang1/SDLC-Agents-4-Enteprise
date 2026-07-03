/**
 * Lightweight event bus for cross-module communication.
 * Uses native CustomEvent API with 'ux:' namespace prefix.
 * KSA-93: Foundation module for UX enhancements.
 */

const PREFIX = 'ux:';

/** Emit an event with optional detail payload. */
export function emit(event, detail = null) {
  document.dispatchEvent(new CustomEvent(PREFIX + event, { detail }));
}

/** Subscribe to an event. Returns unsubscribe function. */
export function on(event, handler) {
  const wrapped = (e) => handler(e.detail);
  document.addEventListener(PREFIX + event, wrapped);
  return () => document.removeEventListener(PREFIX + event, wrapped);
}

/** Subscribe to an event once, auto-removes after first call. */
export function once(event, handler) {
  const wrapped = (e) => {
    handler(e.detail);
    document.removeEventListener(PREFIX + event, wrapped);
  };
  document.addEventListener(PREFIX + event, wrapped);
}

/** Remove a specific handler (must pass same function reference). */
export function off(event, handler) {
  document.removeEventListener(PREFIX + event, handler);
}

/** Convenience: EventBus object for import * style usage. */
export const EventBus = { emit, on, once, off };
export default EventBus;
