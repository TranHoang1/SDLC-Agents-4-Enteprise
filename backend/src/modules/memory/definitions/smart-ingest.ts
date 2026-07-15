/**
 * Smart Ingest tool definitions — mem_smart_ingest + mem_smart_ingest_cleanup.
 * SA4E-38: Local LLM Semantic Evaluation for KB ingestion.
 */

export const SMART_INGEST_TOOLS = [
  {
    name: 'mem_smart_ingest',
    description: 'Evaluate user message via local LLM and auto-ingest if valuable. Falls back to raw ingest when LLM unavailable.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'User message content to evaluate for KB value',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'mem_smart_ingest_cleanup',
    description: 'Re-evaluate unfiltered KB entries in batch using local LLM. Ingests valuable entries and deletes noise.',
    inputSchema: {
      type: 'object',
      properties: {
        batch_size: {
          type: 'number',
          description: 'Max entries to process (1-100, default 50)',
        },
        dry_run: {
          type: 'boolean',
          description: 'Preview mode — no actual changes',
        },
      },
    },
  },
];
