/**
 * SA4E-191 — No-op UI boundary implementation.
 * Production wiring replaces this with a real implementation that drives
 * VSCode webview dialogs/panels/toasts.
 */
import type { SlashCommandUI, DiffEntry, ModelChoice } from './types';

export class NoopSlashCommandUI implements SlashCommandUI {
  async confirm(): Promise<boolean> {
    return true;
  }
  async pickAgent(): Promise<string | null> {
    return null;
  }
  async pickModel(): Promise<string | null> {
    return null;
  }
  showDiffViewer(_changedFiles: DiffEntry[], _emptyState?: string): void {}
  showToast(_message: string): void {}
  showBadge(_label: string): void {}
  showEmptyChat(): void {}
  showChatBlock(_findings: string[]): void {}
}
