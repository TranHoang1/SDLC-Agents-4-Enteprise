/**
 * SA4E-191 — Public surface for the slash-commands module.
 * Re-exports types, registry, adapters, stores, UI, and the 7 handlers so
 * callers can `import { ... } from './slash-commands'`.
 */
export * from './types';
export * from './results';
export * from './audit';
export * from './CommandRegistry';
export * from './registerCommands';

export * from './adapters/timeout';
export * from './adapters/sa4e182CompactionAdapter';
export * from './adapters/sa4e183FileChangeAdapter';
export * from './adapters/sa4e186AgentRoutingAdapter';

export * from './stores/sessionStore';
export * from './stores/chatExchangeStore';
export * from './stores/modelPreferenceStore';

export * from './ui';

export * from './handlers/AgentsCommand';
export * from './handlers/CompactCommand';
export * from './handlers/DiffCommand';
export * from './handlers/ModelsCommand';
export * from './handlers/NewCommand';
export * from './handlers/ReviewCommand';
export * from './handlers/UndoCommand';
