/**
 * SA4E-79: mem_enrich tool definition for MCP registration.
 * Accepts client-generated enrichment metadata for pending KB entries.
 */

export const ENRICH_TOOLS = [
  {
    name: 'mem_enrich',
    description: 'Accept client-generated enrichment metadata for a pending KB entry. Updates summary, tags, and structured_map atomically.',
    inputSchema: {
      type: 'object',
      properties: {
        entry_id: {
          type: 'number',
          description: 'KB entry identifier (knowledge_entries.id)',
        },
        summary: {
          type: 'string',
          description: 'LLM-generated summary of entry content (max 500 chars)',
        },
        tags: {
          type: 'string',
          description: 'Comma-separated tags (max 500 chars total)',
        },
        structured_map: {
          type: 'object',
          description: 'Structured extraction (max 100KB JSON)',
          properties: {
            summary: { type: 'string' },
            business_entities: { type: 'array', items: { type: 'string' } },
            actors: { type: 'array', items: { type: 'string' } },
            business_rules: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['entry_id', 'summary', 'tags'],
    },
  },
];
