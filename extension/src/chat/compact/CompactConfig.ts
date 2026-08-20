/**
 * SA4E-182 — CompactConfig.
 * Reactive configuration reader for auto-compact settings.
 * Subscribes to workspace.onDidChangeConfiguration for live updates (BR-11).
 */

/** Compact settings shape read from VS Code workspace configuration */
export interface CompactSettings {
  autoCompact: boolean;
  autoCompactThreshold: number;
}

/** Minimal workspace interface for DIP (testable without vscode import) */
export interface WorkspaceConfig {
  getConfiguration(section: string): ConfigSection;
  onDidChangeConfiguration(
    listener: (e: ConfigChangeEvent) => void
  ): Disposable;
}

/** Minimal config section interface */
export interface ConfigSection {
  get<T>(key: string, defaultValue: T): T;
}

/** Minimal config change event */
export interface ConfigChangeEvent {
  affectsConfiguration(section: string): boolean;
}

/** Disposable interface */
export interface Disposable {
  dispose(): void;
}

/**
 * Reads and caches compact settings with reactive live-reload.
 * Clamps threshold to [80, 99] range to prevent invalid config.
 */
export class CompactConfig {
  private settings: CompactSettings;
  private disposable: Disposable;

  constructor(private readonly workspace: WorkspaceConfig) {
    this.settings = this.readSettings();
    this.disposable = workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('sa4e.chat')) {
        this.settings = this.readSettings();
      }
    });
  }

  /** Get current cached settings snapshot */
  getSettings(): CompactSettings {
    return this.settings;
  }

  /** Dispose configuration listener */
  dispose(): void {
    this.disposable.dispose();
  }

  /** Read and validate settings from workspace config */
  private readSettings(): CompactSettings {
    const config = this.workspace.getConfiguration('sa4e.chat');
    const rawThreshold = config.get<number>('autoCompactThreshold', 95);
    return {
      autoCompact: config.get<boolean>('autoCompact', true),
      autoCompactThreshold: Math.max(80, Math.min(99, rawThreshold)),
    };
  }
}
