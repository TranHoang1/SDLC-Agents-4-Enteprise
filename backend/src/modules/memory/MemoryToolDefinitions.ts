/** Tier 1 tool definitions — high-frequency standalone tools. */

export const TIER1_TOOLS = [
  {
    name: 'mem_search',
    description: 'Hybrid search across local workspace memory (BM25 + vector + graph). Returns ranked results with progressive disclosure.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)' },
        tier: { type: 'string', description: 'Filter by tier: WORKING, EPISODIC, SEMANTIC, PROCEDURAL' },
        type: { type: 'string', description: 'Filter by type: DECISION, ERROR_PATTERN, ARCHITECTURE, etc.' },
        scope: { type: 'string', description: 'Filter by scope: USER, PROJECT, SHARED, all (default: auto from context)' },
        detail: { type: 'boolean', description: 'If true, include content preview (default: summary only)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'mem_ingest',
    description: 'Store a knowledge entry into local workspace memory (decision, error pattern, lesson learned, etc).',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Full content of the knowledge entry' },
        summary: { type: 'string', description: 'Brief summary (auto-generated if omitted)' },
        type: { type: 'string', description: 'Type: DECISION, ERROR_PATTERN, ARCHITECTURE, API_DESIGN, REQUIREMENT, LESSON_LEARNED, PROCEDURE, CONTEXT' },
        scope: { type: 'string', description: 'Visibility scope: USER (private), PROJECT (team), SHARED (company). Default: USER' },
        user_id: { type: 'string', description: 'Owner user ID (auto from context if omitted)' },
        source: { type: 'string', description: 'Source identifier (file path, ticket, etc)' },

        tags: { type: 'string', description: 'Comma-separated tags' },
        agent_name: { type: 'string', description: 'Agent name (SM, BA, SA, DEV, QA, DevOps, etc.)' },
      },
      required: ['content'],
    },
  },
  {
    name: 'mem_ingest_file',
    description: 'Ingest a document from disk by file path. Zero-context: server reads file directly, agent only sends path (~80 tokens). Auto-chunks markdown by sections.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to document file (relative to workspace or absolute)' },
        type: { type: 'string', description: 'Knowledge type: REQUIREMENT, ARCHITECTURE, DECISION, PROCEDURE, CONTEXT (default: CONTEXT)' },
        scope: { type: 'string', description: 'Visibility scope: USER (private), PROJECT (team), SHARED (company). Default: USER' },
        format: { type: 'string', description: 'Format: markdown (default) or text' },
        content: { type: 'string', description: 'File content (injected by Light Client wrapper)' },
      },
      required: ['file_path'],
    },
  },
];

/** Tier 2 tool definitions — medium-frequency action-based tools. */

export const TIER2_TOOLS = [
  {
    name: 'mem_pin',
    description: 'Core/Archival Memory: pin entries for auto-recall, manage pinned context budget (2000 tokens max).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: pin, unpin, list, reorder, get_context, budget' },
        entry_id: { type: 'number', description: 'Entry ID (for pin/unpin/reorder)' },
        order: { type: 'number', description: 'New position (for reorder)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mem_map',
    description: 'Structured Map: view/update entry metadata (topic, entities, decisions, action items, sentiment). Search by entity or topic.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: get, update, search_entity, search_topic, reextract' },
        entry_id: { type: 'number', description: 'Entry ID (for get/update/reextract)' },
        entity: { type: 'string', description: 'Entity name to search (for search_entity)' },
        topic: { type: 'string', description: 'Topic to search (for search_topic)' },
        map: { type: 'object', description: 'Partial StructuredMap to merge (for update)' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mem_crud',
    description: 'CRUD operations on knowledge entries: get, delete, list.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: get, delete, list' },
        id: { type: 'number', description: 'Entry ID (for get/delete)' },
        tier: { type: 'string', description: 'Filter by tier (for list)' },
        type: { type: 'string', description: 'Filter by type (for list)' },
        limit: { type: 'number', description: 'Max results (for list, default 20)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mem_graph',
    description: 'Query knowledge graph relationships. Actions: neighbors, add_edge, path, ego, auto_link.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: neighbors, add_edge, path, ego, auto_link' },
        node_id: { type: 'number', description: 'Node ID for neighbors/ego/auto_link' },
        source_id: { type: 'number', description: 'Source node for add_edge' },
        target_id: { type: 'number', description: 'Target node for add_edge' },
        relation: { type: 'string', description: 'Edge relation type' },
        from_id: { type: 'number', description: 'Start node for path' },
        to_id: { type: 'number', description: 'End node for path' },
        radius: { type: 'number', description: 'Radius for ego graph (default 2)' },
        limit: { type: 'number', description: 'Max orphans to process for auto_link backfill (default 50)' },
      },
    },
  },
  {
    name: 'mem_consolidate',
    description: 'Tier consolidation: promote/demote entries, merge duplicates with dry-run support.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: consolidate, merge (default: consolidate)' },
        dry_run: { type: 'boolean', description: 'Preview changes without applying (default: false)' },
        survivor_id: { type: 'number', description: 'For merge: ID of entry to keep' },
        merge_ids: { type: 'string', description: 'For merge: comma-separated IDs to merge into survivor' },
        strategy: { type: 'string', description: 'Merge strategy: append, newest (default: append)' },
      },
    },
  },
  {
    name: 'mem_lifecycle',
    description: 'Entry lifecycle: staleness detection, reviews, reminders.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: detect_stale, archive, unarchive, due_reviews, mark_reviewed, schedule, snooze, complete' },
        entry_id: { type: 'number', description: 'Entry ID' },
        threshold: { type: 'number', description: 'Staleness threshold 0-1 (default: 0.8)' },
        dry_run: { type: 'boolean', description: 'Preview without applying (default: false)' },
        days: { type: 'number', description: 'Days since last review (for due_reviews, default: 90)' },
        interval_days: { type: 'number', description: 'Review interval in days (for schedule)' },
        snooze_days: { type: 'number', description: 'Snooze duration in days (default: 7)' },
        reviewer: { type: 'string', description: 'Reviewer identifier' },
        assignee: { type: 'string', description: 'Assignee for reminder' },
        owner: { type: 'string', description: 'Owner identifier' },
        status: { type: 'string', description: 'Review status: pending, approved, rejected, needs_revision' },
        limit: { type: 'number', description: 'Max results (default: 20)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mem_templates',
    description: 'Manage content templates: create, list, validate entries against templates.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: create, list, validate' },
        name: { type: 'string', description: 'Template name (for create)' },
        type: { type: 'string', description: 'Entry type this template applies to' },
        required_sections: { type: 'string', description: 'Comma-separated required section names' },
        entry_id: { type: 'number', description: 'Entry ID to validate' },
      },
    },
  },
  {
    name: 'mem_attachments',
    description: 'Manage file attachments for knowledge entries.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: attach, list, remove, search' },
        entry_id: { type: 'number', description: 'Entry ID' },
        file_path: { type: 'string', description: 'File path to attach' },
        description: { type: 'string', description: 'Attachment description' },
        attachment_id: { type: 'number', description: 'Attachment ID (for remove)' },
        mime_prefix: { type: 'string', description: "MIME type prefix for search (e.g., 'image/')" },
      },
    },
  },
  {
    name: 'mem_discover',
    description: 'Find relevant entries: type-ahead suggestions or related entries.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: suggest, related' },
        query: { type: 'string', description: 'Partial query (for suggest)' },
        entry_id: { type: 'number', description: 'Entry ID (for related)' },
        limit: { type: 'number', description: 'Max results (default: 5)' },
        refresh: { type: 'boolean', description: 'Force recompute related (default: false)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mem_tags',
    description: 'Manage tag taxonomy: create tags, tag/untag entries, search by tags, view taxonomy.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: create, tag, untag, search, taxonomy, popular, entry_tags' },
        tag: { type: 'string', description: 'Tag name (for create)' },
        tags: { type: 'string', description: 'Comma-separated tags (for tag/untag/search)' },
        entry_id: { type: 'number', description: 'Entry ID (for tag/untag/entry_tags)' },
        category: { type: 'string', description: 'Tag category (for create/taxonomy)' },
        parent_tag: { type: 'string', description: 'Parent tag (for hierarchical create)' },
        operator: { type: 'string', description: 'Search operator: AND, OR (default: AND)' },
        limit: { type: 'number', description: 'Max results' },
      },
    },
  },
  {
    name: 'mem_citations',
    description: 'Citation tracking: record citations, view most/least cited entries.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: record, entry, most_cited, uncited, by_agent' },
        entry_id: { type: 'number', description: 'Entry ID' },
        cited_by: { type: 'string', description: 'Who/what is citing (for record)' },
        context: { type: 'string', description: 'Context of the citation (for record)' },
        agent: { type: 'string', description: 'Agent name (for by_agent)' },
        limit: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: ['action'],
    },
  },
];

/** Tier 3 tool definitions — low-frequency scoring, admin, and conversation tools. */

export const TIER3_TOOLS = [
  {
    name: 'mem_conversation',
    description: 'Structured conversation history: save turns, query sessions, search conversation content.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: save_turn, get_session, list_sessions, search, summarize' },
        session_id: { type: 'string', description: 'Session ID (for save_turn/get_session)' },
        role: { type: 'string', description: 'Role: user, assistant, system, tool (for save_turn)' },
        content: { type: 'string', description: 'Turn content (for save_turn)' },
        tool_calls: { type: 'string', description: 'JSON array of tool calls (for save_turn)' },
        query: { type: 'string', description: 'Search query (for search)' },
        limit: { type: 'number', description: 'Max results (default: 20)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mem_scoring',
    description: 'Quality & confidence scoring + feedback for entries.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: quality_score, quality_stats, low_quality, validate, confidence, confidence_stats, unreliable, feedback_submit, feedback_view, top_rated, low_rated' },
        entry_id: { type: 'number', description: 'Entry ID' },
        content: { type: 'string', description: 'Content to validate (for validate action)' },
        type: { type: 'string', description: 'Entry type (for validate)' },
        threshold: { type: 'number', description: 'Quality threshold (default: 40)' },
        rating: { type: 'number', description: 'Rating: 1 (thumbs up) or -1 (thumbs down)' },
        comment: { type: 'string', description: 'Feedback comment' },
        limit: { type: 'number', description: 'Max results (default: 20)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mem_admin',
    description: 'System administration: status, audit trail, sessions, analytics, dashboard, code sync.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: status, audit, sessions, analytics, dashboard, sync_code, popular, gaps, zero_results, metrics, recommendations, trends' },
        limit: { type: 'number', description: 'Max results (default: 20)' },
        operation: { type: 'string', description: 'Filter audit by operation: INGEST, DELETE, SEARCH, CONSOLIDATE, ACCESS' },
        days: { type: 'number', description: 'Trend period in days (default: 30)' },
        kind: { type: 'string', description: 'For sync_code: class, interface, function (default: class+interface)' },
      },
      required: ['action'],
    },
  },
];

export const MEMORY_TOOL_ALIASES = [
  { name: 'mem_promote', description: 'KB scope promotion: scan candidates, list pending, approve/reject, request SHARED, or auto-promote on merge/release.', inputSchema: { type: 'object', properties: { action: { type: 'string', description: 'Action: scan, list, approve, reject, request_shared, promote_on_merge' }, entry_id: { type: 'number', description: 'Entry ID (for approve/reject/request_shared)' }, ticket_key: { type: 'string', description: 'Ticket key (for promote_on_merge — promotes all USER entries for this ticket to PROJECT)' }, reviewer: { type: 'string' }, comment: { type: 'string' }, reason: { type: 'string' }, limit: { type: 'number' } }, required: ['action'] }, category: 'memory' },
  { name: 'mem_get', description: 'Get a knowledge entry by ID (alias for mem_crud get).', inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }, category: 'memory' },
  { name: 'mem_delete', description: 'Delete a knowledge entry by ID (alias for mem_crud delete).', inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }, category: 'memory' },
  { name: 'mem_list', description: 'List knowledge entries (alias for mem_crud list).', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, tier: { type: 'string' }, type: { type: 'string' } } }, category: 'memory' },
  { name: 'mem_status', description: 'Get memory status (alias for mem_admin status).', inputSchema: { type: 'object', properties: {} }, category: 'memory' },
  { name: 'mem_audit', description: 'Get memory audit log (alias for mem_admin audit).', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, operation: { type: 'string' } } }, category: 'memory' },
  { name: 'mem_sessions', description: 'List memory sessions (alias for mem_admin sessions).', inputSchema: { type: 'object', properties: {} }, category: 'memory' },
];

export const MEMORY_TOOL_DEFINITIONS = [...TIER1_TOOLS, ...TIER2_TOOLS, ...TIER3_TOOLS, ...MEMORY_TOOL_ALIASES];
