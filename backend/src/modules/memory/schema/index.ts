import { TABLES } from './tables.js';
import { INDEXES } from './indexes.js';

export const MEMORY_SCHEMA = `${TABLES}\n\n${INDEXES}`;

export { migrateProjectId } from './indexes.js';
export { migrate007Up } from './migrations/007_enrichment_status.js';
