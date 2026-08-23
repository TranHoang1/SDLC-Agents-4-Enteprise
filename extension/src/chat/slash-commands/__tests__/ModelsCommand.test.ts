/**
 * SA4E-191 — ModelsCommand unit tests (UT-10 main, UT-11 EF-1, UT-12 EF-2).
 */
import { describe, it, expect } from 'vitest';
import { ModelsCommand } from '../handlers/ModelsCommand';
import { SessionStore } from '../stores/sessionStore';
import { ModelPreferenceStore, InMemoryPreferenceBackend, type PreferenceBackend } from '../stores/modelPreferenceStore';
import { makeCtx, stubUI, SAMPLE_MODELS } from './helpers';

function prefs(backend: PreferenceBackend): ModelPreferenceStore {
  return new ModelPreferenceStore(backend, 'model_gpt4o', () => SAMPLE_MODELS);
}

describe('ModelsCommand', () => {
  it('UT-10: main flow sets + persists model', async () => {
    const session = new SessionStore(makeCtx('models').session);
    const store = prefs(new InMemoryPreferenceBackend());
    const cmd = new ModelsCommand(session, store, stubUI({ pickModel: async () => 'model_claude' }), () => SAMPLE_MODELS);
    const res = await cmd.execute(makeCtx('models'));
    expect(res.status).toBe('ok');
    expect(session.get().activeModelId).toBe('model_claude');
    expect((res.result as any).persistedModelId).toBe('model_claude');
    // persisted to backend
    expect(await store.loadValidated('usr_1')).toBe('model_claude');
  });

  it('UT-11: EF-1 persistence failure -> PREF_PERSIST_FAILED but still active', async () => {
    const session = new SessionStore(makeCtx('models').session);
    class ThrowingBackend implements PreferenceBackend {
      async load() {
        return null;
      }
      async save() {
        throw new Error('disk fail');
      }
    }
    const cmd = new ModelsCommand(session, prefs(new ThrowingBackend()), stubUI({ pickModel: async () => 'model_claude' }), () => SAMPLE_MODELS);
    const res = await cmd.execute(makeCtx('models'));
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('PREF_PERSIST_FAILED');
    expect(session.get().activeModelId).toBe('model_claude');
  });

  it('UT-12: EF-2 invalid persisted id falls back to default', async () => {
    class GhostBackend implements PreferenceBackend {
      async load() {
        return 'model_ghost';
      }
      async save() {}
    }
    const store = prefs(new GhostBackend());
    expect(await store.loadValidated('usr_1')).toBe('model_gpt4o');
  });
});
