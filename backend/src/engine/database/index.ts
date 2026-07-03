/**
 * Database module barrel export.
 * KSA-153: Graph storage
 * KSA-169: Incremental updater + persistence
 */

export { GraphRepository } from './graph-repository.js';
export type { CallerResult, CalleeResult, RelationshipInput } from './graph-repository.js';

export { runGraphMigrations, isGraphSchemaReady } from './migrator.js';

export { IncrementalUpdater, fnv1aHash } from './incremental-updater.js';
export type { ChangeSet } from './incremental-updater.js';
