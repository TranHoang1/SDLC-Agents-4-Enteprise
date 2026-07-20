import { TIER1_TOOLS } from './search.js';
import { TIER2_TOOLS } from './tier2.js';
import { TIER3_TOOLS, MEMORY_TOOL_ALIASES } from './tier3.js';
import { EVOLUTION_TOOLS } from './evolution.js';
import { SMART_INGEST_TOOLS } from './smart-ingest.js';

export { TIER1_TOOLS } from './search.js';
export { TIER2_TOOLS } from './tier2.js';
export { TIER3_TOOLS, MEMORY_TOOL_ALIASES } from './tier3.js';
export { EVOLUTION_TOOLS } from './evolution.js';
export { SMART_INGEST_TOOLS } from './smart-ingest.js';

export const MEMORY_TOOL_DEFINITIONS = [...TIER1_TOOLS, ...TIER2_TOOLS, ...TIER3_TOOLS, ...EVOLUTION_TOOLS, ...SMART_INGEST_TOOLS, ...MEMORY_TOOL_ALIASES];
