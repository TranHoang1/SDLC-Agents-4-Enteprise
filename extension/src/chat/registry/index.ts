/**
 * SA4E-85 - Agent Registry barrel export.
 * Public API for the agent discovery and hot-reload system.
 */

export type { IAgentRegistry } from './IAgentRegistry';
export { KiroAgentRegistry } from './KiroAgentRegistry';
export { parseAgentFile, deriveAgentId } from './agentParser';
