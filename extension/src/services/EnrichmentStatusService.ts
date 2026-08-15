/**
 * SA4E-157 — Enrichment Status Polling Service.
 * Polls backend for enrichment progress, manages state transitions,
 * drives StatusBarItem display + completion notifications.
 */

import * as vscode from 'vscode';
import type { IndexerHttpClient } from './IndexerHttpClient';
import { EnrichmentStatusResponseSchema } from './enrichment-status-schema';
import type { EnrichmentStatusResponse, EnrichmentState } from './enrichment-status-schema';

// BR-04: Polling intervals per state
const IDLE_INTERVAL = 30000;
const RUNNING_INTERVAL = 5000;
const ERROR_INTERVAL = 15000;
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Polls backend enrichment status, updates VS Code StatusBarItem,
 * and shows completion/error notifications (BR-06: once per cycle).
 */
export class EnrichmentStatusService implements vscode.Disposable {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly statusBarItem: vscode.StatusBarItem;
  private currentState: EnrichmentState = 'idle';
  private previousState: EnrichmentState = 'idle';
  private lastNotifiedState: EnrichmentState | null = null;
  private consecutiveFailures = 0;
  private currentInterval = IDLE_INTERVAL;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(
    private readonly httpClient: IndexerHttpClient,
    private readonly tokenProvider: () => string | undefined,
    outputChannel: vscode.OutputChannel,
  ) {
    this.outputChannel = outputChannel;
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.show();
    this.updateStatusBarIdle();
  }

  /** Start polling (called on extension activation). */
  start(): void {
    this.schedulePoll(this.currentInterval);
  }

  /** Dispose timer + StatusBarItem (BR-11: no orphan intervals). */
  dispose(): void {
    this.clearTimer();
    this.statusBarItem.dispose();
  }

  /** Force immediate poll — used by UC-4 command handler. */
  async pollNow(): Promise<EnrichmentStatusResponse | null> {
    return this.executePoll();
  }

  private schedulePoll(intervalMs: number): void {
    this.clearTimer();
    this.currentInterval = intervalMs;
    this.timer = setInterval(() => { this.executePoll(); }, intervalMs);
  }

  private clearTimer(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  /** Execute a single poll cycle. Returns parsed response or null on failure. */
  private async executePoll(): Promise<EnrichmentStatusResponse | null> {
    try {
      const token = this.tokenProvider();
      const { ok, body } = await this.httpClient.getEnrichmentStatus(token);

      if (!ok) {
        this.handlePollFailure('Backend returned non-200');
        return null;
      }

      const parsed = EnrichmentStatusResponseSchema.safeParse(JSON.parse(body));
      if (!parsed.success) {
        this.log('Zod validation failed: ' + parsed.error.message);
        return null;
      }

      this.consecutiveFailures = 0;
      this.processResponse(parsed.data);
      return parsed.data;
    } catch (err: any) {
      this.handlePollFailure(err.message);
      return null;
    }
  }

  /** Process a successful response — detect transitions, update UI. */
  private processResponse(response: EnrichmentStatusResponse): void {
    this.previousState = this.currentState;
    this.currentState = response.state;

    if (this.previousState !== this.currentState) {
      this.handleStateTransition(this.previousState, this.currentState, response);
      this.adjustInterval(this.currentState);
    }

    this.updateStatusBar(response);
  }

  /** Handle state transition — show notifications (BR-06: once per cycle). */
  private handleStateTransition(
    prev: EnrichmentState, curr: EnrichmentState, response: EnrichmentStatusResponse,
  ): void {
    const msg = 'State: ' + prev + ' -> ' + curr + ' (' + response.totalRules + ' rules, ' + response.failedRules + ' failed)';
    this.log(msg);

    // BR-06: Show completion notification ONCE per enrichment cycle
    if (prev === 'running' && (curr === 'complete' || curr === 'error')) {
      if (this.lastNotifiedState !== curr) {
        this.lastNotifiedState = curr;
        this.showCompletionNotification(response);
      }
    }

    // Reset notification tracking when new cycle starts
    if (curr === 'running' && prev !== 'running') {
      this.lastNotifiedState = null;
    }
  }

  /** Show one-time completion/error notification. */
  private showCompletionNotification(response: EnrichmentStatusResponse): void {
    if (response.failedRules === 0) {
      const msg = 'Enrichment complete: ' + response.totalRules + ' rules enriched. KB is ready.';
      vscode.window.showInformationMessage(msg);
    } else {
      const msg = 'Enrichment complete: ' + response.completedRules + '/' + response.totalRules + ' rules enriched. ' + response.failedRules + ' rules failed.';
      vscode.window.showWarningMessage(msg, 'Show Details').then((action) => {
        if (action === 'Show Details') { this.outputChannel.show(); }
      });
    }
  }

  /** Update StatusBarItem text/tooltip per BR-05. */
  private updateStatusBar(response: EnrichmentStatusResponse): void {
    switch (response.state) {
      case 'running':
        this.statusBarItem.text = '$(sync~spin) Enriching: ' + response.completedRules + '/' + response.totalRules + ' (' + response.percent + '%)';
        this.statusBarItem.tooltip = this.buildRunningTooltip(response);
        this.statusBarItem.command = 'sa4e.showEnrichmentStatus';
        this.statusBarItem.color = undefined;
        break;
      case 'error':
        this.statusBarItem.text = '$(warning) KB: ' + response.failedRules + ' failed';
        this.statusBarItem.tooltip = 'Enrichment completed with errors\n' + response.failedRules + ' rules failed\nClick for details';
        this.statusBarItem.command = 'sa4e.showEnrichmentStatus';
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        break;
      default:
        this.updateStatusBarIdle();
        break;
    }
  }

  private updateStatusBarIdle(): void {
    this.statusBarItem.text = '$(database) KB: Ready';
    this.statusBarItem.tooltip = 'Knowledge Base enrichment is idle';
    this.statusBarItem.command = undefined;
    this.statusBarItem.color = undefined;
  }

  private buildRunningTooltip(r: EnrichmentStatusResponse): string {
    const lines = ['LLM Enrichment in progress'];
    if (r.startedAt) { lines.push('Started: ' + new Date(r.startedAt).toLocaleTimeString()); }
    if (r.estimatedCompletion) { lines.push('Estimated: ' + new Date(r.estimatedCompletion).toLocaleTimeString()); }
    if (r.failedRules > 0) { lines.push('Failed: ' + r.failedRules); }
    return lines.join('\n');
  }

  /** Adjust polling interval based on current state (BR-04). */
  private adjustInterval(state: EnrichmentState): void {
    const interval = state === 'running' ? RUNNING_INTERVAL
      : state === 'error' ? ERROR_INTERVAL
      : IDLE_INTERVAL;
    if (interval !== this.currentInterval) { this.schedulePoll(interval); }
  }

  /** Handle poll failure — track consecutive failures for degradation (EF-1). */
  private handlePollFailure(reason: string): void {
    this.consecutiveFailures++;
    this.log('Poll failed: ' + reason + ' (attempt ' + this.consecutiveFailures + '/' + MAX_CONSECUTIVE_FAILURES + ')');
    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.statusBarItem.text = '$(warning) KB: Offline';
      this.statusBarItem.tooltip = 'Cannot reach backend';
      this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    }
  }

  private log(msg: string): void {
    this.outputChannel.appendLine('[Enrichment] ' + msg);
  }
}