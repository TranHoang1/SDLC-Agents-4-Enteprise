/**
 * Unit tests for Pega local tool registration (pega-local-tools.ts):
 * - getPegaLocalToolDefinitions() exposes all pega_* tool schemas.
 * - registerPegaLocalTools() wires PegaMcpTools methods into the local registry,
 *   making them executable via executeLocalTool() and discoverable via
 *   getLocalToolDefinitions().
 */

import { describe, it, expect, vi } from "vitest";
import { registerLocalTool, executeLocalTool, getLocalToolDefinitions, getVisibleLocalToolDefinitions, isLocalTool } from "../backend-local-tools";
import { registerPegaLocalTools, getPegaLocalToolDefinitions } from "../mcp/pega-local-tools";
import { PegaMcpTools } from "../mcp/PegaMcpTools";

function mockPegaTools() {
  const tools = {
    getSessionContext: vi.fn(async () => ({ success: true, context: { operatorId: "SSA@TGB" } })),
    getRuleByInsKey: vi.fn(async () => ({ success: true, data: { pyRuleName: "MyRule" } })),
    queryRule: vi.fn(async () => ({ success: true, data: {} })),
    listRules: vi.fn(async () => ({ success: true, data: { total: 0 } })),
    saveRule: vi.fn(async () => ({ success: true, data: {} })),
    checkoutRule: vi.fn(async () => ({ success: true, data: {} })),
    runTests: vi.fn(async () => ({ success: true, data: {} })),
    createBranch: vi.fn(async () => ({ success: true, data: {}, context: { branchName: "SSA_SA4E-58" } })),
  };
  return tools as unknown as PegaMcpTools;
}

const PEGA_TOOL_NAMES = [
  "pega_get_session_context",
  "pega_get_rule",
  "pega_query_rule",
  "pega_list_rules",
  "pega_save_rule",
  "pega_checkout_rule",
  "pega_run_tests",
  "pega_create_branch",
];

describe("getPegaLocalToolDefinitions", () => {
  it("returns a definition for every Pega tool", () => {
    const defs = getPegaLocalToolDefinitions();
    expect(defs.map((d) => d.name)).toEqual(PEGA_TOOL_NAMES);
  });

  it("defines input schemas with required params for save/branch tools", () => {
    const defs = getPegaLocalToolDefinitions();
    const save = defs.find((d) => d.name === "pega_save_rule")!;
    expect(save.inputSchema.properties.ruleJson).toBeDefined();
    expect(save.inputSchema.required).toContain("ruleJson");

    const branch = defs.find((d) => d.name === "pega_create_branch")!;
    expect(branch.inputSchema.required).toContain("rulesetName");
  });
});

describe("registerPegaLocalTools", () => {
  it("registers handlers into the local tool registry (discoverable via getLocalToolDefinitions)", () => {
    registerPegaLocalTools(mockPegaTools());

    const names = getLocalToolDefinitions().map((d) => d.name);
    for (const toolName of PEGA_TOOL_NAMES) {
      expect(isLocalTool(toolName)).toBe(true);
      expect(names).toContain(toolName);
    }
  });

  it("executes pega_get_session_context via executeLocalTool and wraps result", async () => {
    const pegaTools = mockPegaTools();
    registerPegaLocalTools(pegaTools);

    const result = (await executeLocalTool("pega_get_session_context", {})) as any;
    expect(pegaTools.getSessionContext).toHaveBeenCalled();
    expect(result.isError).toBe(false);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text).context.operatorId).toBe("SSA@TGB");
  });

  it("forwards args to the Pega handler and maps success:false to isError", async () => {
    const pegaTools = mockPegaTools();
    (pegaTools.createBranch as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async () => ({ success: false, error: "branchName required" })
    );
    registerPegaLocalTools(pegaTools);

    const result = (await executeLocalTool("pega_create_branch", { rulesetName: "HRAppsV2" })) as any;
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe("branchName required");
  });

  it("wraps thrown handler errors into a text result without propagating", async () => {
    const pegaTools = mockPegaTools();
    (pegaTools.getRuleByInsKey as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async () => { throw new Error("boom"); }
    );
    registerPegaLocalTools(pegaTools);

    const result = (await executeLocalTool("pega_get_rule", { insKey: "x" })) as any;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("boom");
  });

  it("does not override existing local tools (registerLocalTool is additive)", () => {
    registerLocalTool("pega_unique_check_tool", async () => ({}), {
      name: "pega_unique_check_tool",
      description: "probe",
      inputSchema: { type: "object", properties: {} },
    });
    expect(isLocalTool("pega_unique_check_tool")).toBe(true);
  });

  it("marks Pega tools as hidden — excluded from tools/list, kept in find_tools", () => {
    registerPegaLocalTools(mockPegaTools());

    const visibleNames = getVisibleLocalToolDefinitions().map((d) => d.name);
    const allNames = getLocalToolDefinitions().map((d) => d.name);

    for (const toolName of PEGA_TOOL_NAMES) {
      expect(allNames).toContain(toolName);
      expect(visibleNames).not.toContain(toolName);
    }
    expect(visibleNames).toContain("stream_write_file");
    expect(visibleNames).toContain("embed_image");
  });
});
