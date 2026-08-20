/**
 * SA4E-182 — CompactMonitor.
 * Subscribes to IdeContextManager state changes and triggers auto-compact
 * using hysteresis debounce logic (BR-05, BR-15).
 * Trigger at threshold; reset debounce at (threshold - 10%).
 */

import type { CompactMonitorState, CompactTrigger } from './types';
import type { CompactConfig } from './CompactConfig';

/** Minimal context state shape consumed by monitor */
export interface MonitorContextState {
  usagePercent: number;
  tokenCount: number;
}

/** Context manager subscription interface (DIP) */
export interface ContextManagerSubscription {
  onContextChanged: {
    (listener: (state: MonitorContextState) => void): Disposable;
  };
  getState(): MonitorContextState;
}

/** Disposable for cleanup */
interface Disposable {
  dispose(): void;
}

/** Callback type for compact trigger */
export type CompactTriggerFn = (trigger: CompactTrigger) => Promise<void>;

/**
 * Watches context usage and fires auto-compact when threshold is crossed.
 * Implements hysteresis: after triggering, debounce stays active until
 * usage drops below (threshold - 10%), preventing oscillation.
 */
export class CompactMonitor {
  private state: CompactMonitorState = {
    isCompacting: false,
    debounceActive: false,
    lastThresholdCrossing: null,
  };
  private subscription: Disposable | null = null;

  constructor(
    private readonly contextManager: ContextManagerSubscription,
    private readonly config: CompactConfig,
    private readonly onTrigger: CompactTriggerFn
  ) {}

  /** Start monitoring context state changes */
  start(): void {
    if (this.subscription) return;
    this.subscription = this.contextManager.onContextChanged(
      (newState) => this.onContextStateChange(newState)
    );
  }

  /** Stop monitoring and dispose subscription */
  stop(): void {
    this.subscription?.dispose();
    this.subscription = null;
  }

  /** Get current monitor state (for concurrency checks) */
  getState(): CompactMonitorState {
    return { ...this.state };
  }

  /** Set compacting flag (called by CompactService via shared state) */
  setCompacting(value: boolean): void {
    this.state.isCompacting = value;
  }

  /** Expose shared state reference for CompactService mutex */
  getSharedState(): CompactMonitorState {
    return this.state;
  }

  /**
   * Handle context state change — hysteresis logic (BR-04, BR-05, BR-15).
   * Fires auto-compact at threshold, resets debounce at (threshold - 10%).
   */
  private onContextStateChange(newState: MonitorContextState): void {
    const { autoCompact, autoCompactThreshold } = this.config.getSettings();

    if (!autoCompact) return;
    if (this.state.isCompacting) return;

    const resetThreshold = autoCompactThreshold - 10;

    if (newState.usagePercent >= autoCompactThreshold) {
      this.handleThresholdCrossed();
    } else if (newState.usagePercent < resetThreshold) {
      this.handleHysteresisReset();
    }
  }

  /** Threshold crossed upward — trigger if not debounced */
  private handleThresholdCrossed(): void {
    if (this.state.debounceActive) return;

    this.state.debounceActive = true;
    this.state.lastThresholdCrossing = Date.now();
    this.onTrigger('auto').catch((err) => {
      console.error('[compact-monitor] Auto-compact failed:', err);
    });
  }

  /** Usage dropped below reset threshold — clear debounce (BR-15) */
  private handleHysteresisReset(): void {
    if (!this.state.debounceActive) return;

    this.state.debounceActive = false;
    this.state.lastThresholdCrossing = null;
  }
}
