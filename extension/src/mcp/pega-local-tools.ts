/**
 * PegaLocalTools — registers Pega MCP tool handlers (PegaMcpTools) into the
 * extension's local tool registry so they are:
 *   1. Listed in tools/list (via getLocalToolDefinitions())
 *   2. Discoverable via find_tools (WrapperServer merges local defs)
 *   3. Executable locally (routeToolCall → executeLocalTool)
 *
 * OCP: mapping table — add a handler here to expose a new pega tool.
 */
import { registerLocalTool, LocalToolDefinition } from "../backend-local-tools";
import { PegaMcpTools } from "./PegaMcpTools";

/** Wrap a PegaMcpTools result into the MCP text-result shape. */
function toMcpResult(result: { success?: boolean } & Record<string, unknown>): any {
  const ok = result?.success !== false;
  return {
    isError: !ok,
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
}

/** Bound handler factory — keeps PegaMcpTools stateless w.r.t. routing. */
type PegaHandler = (tools: PegaMcpTools, args: Record<string, unknown>) => Promise<Record<string, unknown>>;

interface PegaToolSpec {
  name: string;
  description: string;
  handler: PegaHandler;
  inputSchema: Record<string, unknown>;
}

const PEGA_TOOL_SPECS: PegaToolSpec[] = [
  {
    name: "pega_get_session_context",
    description: "Get current Pega operator session context (operator, access group, application, ruleset stack).",
    handler: (t) => t.getSessionContext(),
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pega_get_rule",
    description: "Fetch a Pega rule by its insKey (Service 1).",
    handler: (t, a) => t.getRuleByInsKey(a),
    inputSchema: {
      type: "object",
      properties: {
        insKey: { type: "string", description: "Rule instance key, e.g. RULE-OBJ-ACTIVITY MyClass!MyRule" },
        key: { type: "string", description: "Alias for insKey" },
      },
      required: ["insKey"],
    },
  },
  {
    name: "pega_query_rule",
    description: "Query a Pega rule by class/name triple (Service 2).",
    handler: (t, a) => t.queryRule(a),
    inputSchema: {
      type: "object",
      properties: {
        pxObjClass: { type: "string", description: "Rule class (e.g. Rule-Obj-Activity)" },
        className: { type: "string", description: "Alias for pxObjClass" },
        appliesTo: { type: "string", description: "Applies-to class" },
        pyClassName: { type: "string", description: "Alias for appliesTo" },
        pyRuleName: { type: "string", description: "Rule name" },
        ruleName: { type: "string", description: "Alias for pyRuleName" },
      },
      required: ["pxObjClass", "pyRuleName"],
    },
  },
  {
    name: "pega_list_rules",
    description: "List Pega rules of a class, paginated (Service 3).",
    handler: (t, a) => t.listRules(a),
    inputSchema: {
      type: "object",
      properties: {
        pxObjClass: { type: "string", default: "Rule-Obj-Activity", description: "Rule class to list" },
        className: { type: "string", description: "Alias for pxObjClass" },
        pageSize: { type: "number", default: 50 },
        pageIndex: { type: "number", default: 1 },
      },
      required: [],
    },
  },
  {
    name: "pega_save_rule",
    description: "Save a Pega rule with automatic RuleSet/branch context resolution (Service 4).",
    handler: (t, a) => t.saveRule(a),
    inputSchema: {
      type: "object",
      properties: {
        ruleJson: { type: "object", description: "Rule JSON payload (or use 'payload' string)" },
        payload: { type: "string", description: "Rule JSON as string" },
        ticketId: { type: "string", description: "Jira ticket key to derive branch (e.g. SA4E-58)" },
        crId: { type: "string", description: "Alias for ticketId" },
        developerShortName: { type: "string", description: "Developer short name for branch naming" },
        preferBranch: { type: "boolean", description: "Force save into branch version" },
      },
      required: ["ruleJson"],
    },
  },
  {
    name: "pega_checkout_rule",
    description: "Checkout/checkin/undo-checkout a Pega rule with branch context (Service 5).",
    handler: (t, a) => t.checkoutRule(a),
    inputSchema: {
      type: "object",
      properties: {
        insKey: { type: "string", description: "Rule insKey to checkout" },
        action: { type: "string", enum: ["CHECKOUT", "CHECKIN", "UNDOCHECKOUT"], default: "CHECKOUT" },
        comment: { type: "string", description: "Checkin/checkout comment" },
        ticketId: { type: "string", description: "Jira ticket key to derive branch" },
        crId: { type: "string", description: "Alias for ticketId" },
        developerShortName: { type: "string", description: "Developer short name for branch naming" },
      },
      required: ["insKey"],
    },
  },
  {
    name: "pega_run_tests",
    description: "Execute a scenario test suite in Pega (Service 6).",
    handler: (t, a) => t.runTests(a),
    inputSchema: {
      type: "object",
      properties: {
        testSuiteID: { type: "string", description: "Scenario test suite ID" },
        suiteId: { type: "string", description: "Alias for testSuiteID" },
        insKey: { type: "string", description: "Rule insKey variant" },
      },
      required: [],
    },
  },
  {
    name: "pega_create_branch",
    description: "Create a Pega ruleset branch version when no open version exists (Service 7).",
    handler: (t, a) => t.createBranch(a),
    inputSchema: {
      type: "object",
      properties: {
        rulesetName: { type: "string", description: "Target ruleset name" },
        baseVersion: { type: "string", default: "01-01-01", description: "Base ruleset version" },
        branchName: { type: "string", description: "Branch name (auto-derived from ticketId + developerShortName if omitted)" },
        ticketId: { type: "string", description: "Jira ticket key (e.g. SA4E-58)" },
        crId: { type: "string", description: "Alias for ticketId" },
        developerShortName: { type: "string", description: "Developer short name for branch naming" },
      },
      required: ["rulesetName"],
    },
  },
];

/** Register every Pega tool into the local tool registry. Idempotent-safe. */
export function registerPegaLocalTools(pegaTools: PegaMcpTools): void {
  for (const spec of PEGA_TOOL_SPECS) {
    registerLocalTool(spec.name, async (args) => {
      try {
        return toMcpResult(await spec.handler(pegaTools, args));
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: `pega_${spec.name}: ${err.message}` }] };
      }
    }, toDefinition(spec));
  }
}

/** Standalone definitions — used to merge into find_tools responses. */
export function getPegaLocalToolDefinitions(): LocalToolDefinition[] {
  return PEGA_TOOL_SPECS.map(toDefinition);
}

function toDefinition(spec: PegaToolSpec): LocalToolDefinition {
  return { name: spec.name, description: spec.description, inputSchema: spec.inputSchema, hidden: true };
}
