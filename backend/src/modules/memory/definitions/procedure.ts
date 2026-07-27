export const PROCEDURE_TOOLS = [
  {
    name: 'mem_procedure',
    description: 'Manage procedure definitions — create, list, get, delete, search. Procedures are reusable tool sequences stored in the knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'list', 'get', 'delete', 'search'],
          description: 'Action to perform',
        },
        name: { type: 'string', description: 'Procedure name (for create/get/delete)' },
        description: { type: 'string', description: 'Procedure description (for create)' },
        steps: {
          type: 'string',
          description: 'JSON array of step objects: [{"tool":"mem_search","args":{"query":"..."}}] (for create)',
        },
        tags: { type: 'string', description: 'Comma-separated tags (for create/search)' },
        limit: { type: 'number', description: 'Max results (default: 20)' },
        query: { type: 'string', description: 'Search query (for search action)' },
        id: { type: 'number', description: 'Entry ID (for get/delete by ID)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mem_skill_capture',
    description: 'Capture a sequence of recent tool calls as a reusable procedure/skill.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the captured skill' },
        description: { type: 'string', description: 'Description of what this skill does' },
        session_id: { type: 'string', description: 'Session ID to capture from (default: current session)' },
        max_turns: { type: 'number', description: 'Max recent turns to scan (default: 20)' },
        filter_tools: { type: 'string', description: 'Comma-separated tool names to include (default: all)' },
        tags: { type: 'string', description: 'Comma-separated tags' },
      },
      required: ['name'],
    },
  },
  {
    name: 'mem_skill_execute',
    description: 'Execute a saved procedure/skill by replaying its tool steps sequentially.',
    inputSchema: {
      type: 'object',
      properties: {
        procedure_id: { type: 'number', description: 'Knowledge entry ID of the procedure' },
        name: { type: 'string', description: 'Procedure name (alternative to procedure_id)' },
        variables: { type: 'string', description: 'JSON object of variable substitutions for step args' },
      },
      oneOf: [{ required: ['procedure_id'] }, { required: ['name'] }],
    },
  },
];
