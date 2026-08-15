/**
 * SA4E-110 — Confluence page, search, and space tools (16 tools).
 * Pages (7), search (4), spaces+labels (5).
 */
import { registerLocalTool, LocalToolDefinition } from "../../backend-local-tools";
import { AtlassianHttpClient, toResult, toErrorResult } from "./atlassian-http-client";
import { registerConfluenceContentTools } from "./confluence-content-tools";

/** Register all 23 Confluence tools (delegates content/comment tools to separate file) */
export function registerConfluenceTools(client: AtlassianHttpClient): void {
  registerPageTools(client);
  registerSearchTools(client);
  registerSpaceTools(client);
  registerConfluenceContentTools(client); // 7 tools: attachments, history, version, analytics, comments
}

function registerPageTools(client: AtlassianHttpClient): void {
  reg("confluence_get_page", "Get a Confluence page by ID", {
    type: "object",
    properties: { page_id: { type: "string" }, expand: { type: "string" } },
    required: ["page_id"],
  }, async (a) => {
    const qs = a.expand ? `?expand=${a.expand}` : "";
    return toResult(await client.request("GET", `/wiki/rest/api/content/${a.page_id}${qs}`));
  });

  reg("confluence_create_page", "Create a new Confluence page", {
    type: "object",
    properties: {
      space_key: { type: "string" }, title: { type: "string" }, body: { type: "string" },
      parent_id: { type: "string" }, representation: { type: "string", default: "storage" },
    },
    required: ["space_key", "title", "body"],
  }, async (a) => {
    const rep = a.representation || "storage";
    const payload: Record<string, unknown> = {
      type: "page", title: a.title, space: { key: a.space_key },
      body: { [rep as string]: { value: a.body, representation: rep } },
    };
    if (a.parent_id) payload.ancestors = [{ id: a.parent_id }];
    return toResult(await client.request("POST", "/wiki/rest/api/content", payload));
  });

  reg("confluence_update_page", "Update an existing Confluence page", {
    type: "object",
    properties: {
      page_id: { type: "string" }, title: { type: "string" }, body: { type: "string" },
      version_number: { type: "number" }, representation: { type: "string", default: "storage" },
    },
    required: ["page_id", "title", "body", "version_number"],
  }, async (a) => {
    const rep = a.representation || "storage";
    const payload = {
      type: "page", title: a.title,
      body: { [rep as string]: { value: a.body, representation: rep } },
      version: { number: a.version_number },
    };
    return toResult(await client.request("PUT", `/wiki/rest/api/content/${a.page_id}`, payload));
  });

  reg("confluence_delete_page", "Delete a Confluence page", {
    type: "object", properties: { page_id: { type: "string" } }, required: ["page_id"],
  }, async (a) => {
    await client.request("DELETE", `/wiki/rest/api/content/${a.page_id}`);
    return toResult({ status: 204, data: { success: true } });
  });

  reg("confluence_get_page_by_title", "Find a page by title in a space", {
    type: "object",
    properties: { space_key: { type: "string" }, title: { type: "string" } },
    required: ["space_key", "title"],
  }, async (a) => {
    const qs = `spaceKey=${a.space_key}&title=${encodeURIComponent(a.title as string)}`;
    return toResult(await client.request("GET", `/wiki/rest/api/content?${qs}`));
  });

  reg("confluence_get_children", "Get child pages", {
    type: "object",
    properties: { page_id: { type: "string" }, start: { type: "number", default: 0 }, limit: { type: "number", default: 25 } },
    required: ["page_id"],
  }, async (a) => {
    return toResult(await client.request("GET", `/wiki/rest/api/content/${a.page_id}/child/page?start=${a.start ?? 0}&limit=${a.limit ?? 25}`));
  });

  reg("confluence_get_ancestors", "Get ancestor pages", {
    type: "object", properties: { page_id: { type: "string" } }, required: ["page_id"],
  }, async (a) => toResult(await client.request("GET", `/wiki/rest/api/content/${a.page_id}?expand=ancestors`)));
}

function registerSearchTools(client: AtlassianHttpClient): void {
  reg("confluence_search", "Search Confluence with CQL", {
    type: "object",
    properties: { cql: { type: "string" }, start: { type: "number", default: 0 }, limit: { type: "number", default: 25 } },
    required: ["cql"],
  }, async (a) => {
    const qs = `cql=${encodeURIComponent(a.cql as string)}&start=${a.start ?? 0}&limit=${a.limit ?? 25}`;
    return toResult(await client.request("GET", `/wiki/rest/api/content/search?${qs}`));
  });

  reg("confluence_search_content", "Search content by text query", {
    type: "object",
    properties: {
      query: { type: "string" }, space_key: { type: "string" },
      type: { type: "string" }, start: { type: "number", default: 0 }, limit: { type: "number", default: 25 },
    },
    required: ["query"],
  }, async (a) => {
    let cql = `text ~ "${a.query}"`;
    if (a.space_key) cql += ` AND space = "${a.space_key}"`;
    if (a.type) cql += ` AND type = "${a.type}"`;
    const qs = `cql=${encodeURIComponent(cql)}&start=${a.start ?? 0}&limit=${a.limit ?? 25}`;
    return toResult(await client.request("GET", `/wiki/rest/api/content/search?${qs}`));
  });

  reg("confluence_get_recent", "Get recently modified content", {
    type: "object",
    properties: { start: { type: "number", default: 0 }, limit: { type: "number", default: 25 } },
    required: [],
  }, async (a) => {
    return toResult(await client.request("GET", `/wiki/rest/api/content?orderby=lastmodified desc&start=${a.start ?? 0}&limit=${a.limit ?? 25}`));
  });

  reg("confluence_get_by_label", "Get content by label", {
    type: "object",
    properties: { label: { type: "string" }, space_key: { type: "string" }, start: { type: "number", default: 0 }, limit: { type: "number", default: 25 } },
    required: ["label"],
  }, async (a) => {
    let cql = `label = "${a.label}"`;
    if (a.space_key) cql += ` AND space = "${a.space_key}"`;
    const qs = `cql=${encodeURIComponent(cql)}&start=${a.start ?? 0}&limit=${a.limit ?? 25}`;
    return toResult(await client.request("GET", `/wiki/rest/api/content/search?${qs}`));
  });
}

function registerSpaceTools(client: AtlassianHttpClient): void {
  reg("confluence_get_spaces", "List all Confluence spaces", {
    type: "object",
    properties: { type: { type: "string" }, start: { type: "number", default: 0 }, limit: { type: "number", default: 25 } },
    required: [],
  }, async (a) => {
    const typeQs = a.type ? `&type=${a.type}` : "";
    return toResult(await client.request("GET", `/wiki/rest/api/space?start=${a.start ?? 0}&limit=${a.limit ?? 25}${typeQs}`));
  });

  reg("confluence_get_space", "Get space details by key", {
    type: "object", properties: { space_key: { type: "string" } }, required: ["space_key"],
  }, async (a) => toResult(await client.request("GET", `/wiki/rest/api/space/${a.space_key}`)));

  reg("confluence_get_space_content", "Get content in a space", {
    type: "object",
    properties: { space_key: { type: "string" }, type: { type: "string", default: "page" }, start: { type: "number", default: 0 }, limit: { type: "number", default: 25 } },
    required: ["space_key"],
  }, async (a) => {
    const t = a.type || "page";
    return toResult(await client.request("GET", `/wiki/rest/api/space/${a.space_key}/content/${t}?start=${a.start ?? 0}&limit=${a.limit ?? 25}`));
  });

  reg("confluence_add_label", "Add a label to a page", {
    type: "object", properties: { page_id: { type: "string" }, label: { type: "string" } }, required: ["page_id", "label"],
  }, async (a) => toResult(await client.request("POST", `/wiki/rest/api/content/${a.page_id}/label`, [{ prefix: "global", name: a.label }])));

  reg("confluence_get_labels", "Get labels on a page", {
    type: "object", properties: { page_id: { type: "string" } }, required: ["page_id"],
  }, async (a) => toResult(await client.request("GET", `/wiki/rest/api/content/${a.page_id}/label`)));
}



/** DRY helper — registers a tool with hidden:true + error boundary */
function reg(
  name: string, description: string, inputSchema: Record<string, unknown>,
  handler: (args: Record<string, any>) => Promise<any>,
): void {
  const def: LocalToolDefinition = { name, description, inputSchema, hidden: true };
  registerLocalTool(name, async (args) => {
    try { return await handler(args); } catch (e) { return toErrorResult(e); }
  }, def);
}
