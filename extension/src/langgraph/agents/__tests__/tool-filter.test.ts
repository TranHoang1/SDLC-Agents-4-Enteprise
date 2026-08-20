/**
 * SA4E-186 — Unit Tests: ToolFilter (UT-01 to UT-08).
 * Tests pure tool filtering functions.
 */

import { describe, it, expect } from "vitest";
import {
  isToolAllowed,
  filterTools,
  buildToolBlockedMessage,
} from "../tool-filter";
import type { McpToolDefinition } from "../../vscode/tool-registry";

describe("isToolAllowed", () => {
  // UT-01: undefined patterns → all tools allowed
  it("returns true when patterns is undefined (no restriction)", () => {
    expect(isToolAllowed("any_tool", undefined)).toBe(true);
    expect(isToolAllowed("read_file", undefined)).toBe(true);
  });

  // UT-02: empty array → text-only mode, no tools allowed
  it("returns false when patterns is empty array (text-only)", () => {
    expect(isToolAllowed("any_tool", [])).toBe(false);
    expect(isToolAllowed("read_file", [])).toBe(false);
  });

  // UT-03: exact match
  it("returns true for exact match", () => {
    expect(isToolAllowed("read_file", ["read_file", "write_file"])).toBe(true);
    expect(isToolAllowed("write_file", ["read_file", "write_file"])).toBe(true);
  });

  // UT-04: no match
  it("returns false when tool does not match any pattern", () => {
    expect(isToolAllowed("delete_file", ["read_file", "write_file"])).toBe(
      false
    );
  });

  // UT-05: prefix wildcard match
  it("returns true for prefix wildcard match (pattern ends with *)", () => {
    expect(isToolAllowed("mem_search", ["mem_*"])).toBe(true);
    expect(isToolAllowed("mem_ingest", ["mem_*"])).toBe(true);
    expect(isToolAllowed("code_search", ["mem_*"])).toBe(false);
  });

  // UT-06: mixed exact and wildcard patterns
  it("supports mixed exact and wildcard patterns", () => {
    const patterns = ["read_file", "mem_*", "jira_get_issue"];
    expect(isToolAllowed("read_file", patterns)).toBe(true);
    expect(isToolAllowed("mem_search", patterns)).toBe(true);
    expect(isToolAllowed("jira_get_issue", patterns)).toBe(true);
    expect(isToolAllowed("jira_create_issue", patterns)).toBe(false);
    expect(isToolAllowed("write_file", patterns)).toBe(false);
  });

  // UT-07: wildcard with empty prefix (just "*")
  it("allows all tools when pattern is just '*'", () => {
    expect(isToolAllowed("anything", ["*"])).toBe(true);
    expect(isToolAllowed("read_file", ["*"])).toBe(true);
  });
});

describe("filterTools", () => {
  const mockTools: McpToolDefinition[] = [
    { name: "read_file", description: "Read a file", inputSchema: {} },
    { name: "write_file", description: "Write a file", inputSchema: {} },
    { name: "mem_search", description: "Search memory", inputSchema: {} },
    { name: "mem_ingest", description: "Ingest to memory", inputSchema: {} },
    { name: "jira_get_issue", description: "Get Jira issue", inputSchema: {} },
  ];

  it("returns all tools when patterns is undefined", () => {
    const result = filterTools(mockTools, undefined);
    expect(result).toHaveLength(5);
    expect(result).toBe(mockTools); // same reference for performance
  });

  it("returns empty array when patterns is empty", () => {
    const result = filterTools(mockTools, []);
    expect(result).toHaveLength(0);
  });

  it("filters tools by exact match and wildcard", () => {
    const result = filterTools(mockTools, ["read_file", "mem_*"]);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.name)).toEqual([
      "read_file",
      "mem_search",
      "mem_ingest",
    ]);
  });
});

describe("buildToolBlockedMessage", () => {
  // UT-08: builds readable error message
  it("builds a message with tool name, agent id, and allowed patterns", () => {
    const msg = buildToolBlockedMessage("delete_file", "dev-agent", [
      "read_file",
      "write_file",
    ]);
    expect(msg).toContain("delete_file");
    expect(msg).toContain("dev-agent");
    expect(msg).toContain("read_file");
    expect(msg).toContain("write_file");
  });

  it("truncates when more than 5 patterns", () => {
    const patterns = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta"];
    const msg = buildToolBlockedMessage("x", "agent", patterns);
    expect(msg).toContain("... (7 total)");
    expect(msg).not.toContain("zeta");
  });
});
