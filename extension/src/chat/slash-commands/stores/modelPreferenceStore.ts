/**
 * SA4E-191 — Model preference store (BR-6 persistence).
 * Persists the active model per user via an injected PreferenceBackend.
 * Validates a stored id against the current model registry on load (EF-2).
 */
import type { ModelChoice } from '../types';

export interface PreferenceBackend {
  load(userId: string): Promise<string | null>;
  save(userId: string, modelId: string): Promise<void>;
}

/** Simple in-memory backend (used in tests and as a fallback). */
export class InMemoryPreferenceBackend implements PreferenceBackend {
  private readonly map = new Map<string, string>();

  async load(userId: string): Promise<string | null> {
    return this.map.get(userId) ?? null;
  }

  async save(userId: string, modelId: string): Promise<void> {
    this.map.set(userId, modelId);
  }
}

export class ModelPreferenceStore {
  private cached: string | null = null;

  constructor(
    private readonly backend: PreferenceBackend,
    private readonly defaultModelId: string,
    private readonly getRegistry: () => ModelChoice[]
  ) {}

  async load(userId: string): Promise<string | null> {
    const stored = await this.backend.load(userId);
    this.cached = stored;
    return stored;
  }

  async save(userId: string, modelId: string): Promise<void> {
    this.cached = modelId;
    await this.backend.save(userId, modelId);
  }

  /** Validate a stored id against the registry; fall back to default (EF-2). */
  resolveValidModelId(stored: string | null): string {
    if (stored && this.getRegistry().some((m) => m.id === stored)) {
      return stored;
    }
    return this.defaultModelId;
  }

  async loadValidated(userId: string): Promise<string> {
    const stored = await this.load(userId);
    return this.resolveValidModelId(stored);
  }

  get active(): string | null {
    return this.cached;
  }
}
