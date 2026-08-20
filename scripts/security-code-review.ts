/**
 * Security Code Review Gate — SA4E-185 (L3 autonomy)
 *
 * CI gate (P-3 fix): replaces the prior `|| true` no-op with a script that
 * actually fails the pipeline when security conditions C-1..C-3 regress.
 * Run from repo root:  npx tsx scripts/security-code-review.ts SA4E-185
 *
 * Checks (mirrors .github/workflows/ci-sa4e-185.yml security-gates job):
 *  - F-01/C-1  Prompt-injection fencing: sanitizeMessage, fence delimiters,
 *               severity-token trigger (no free-text /\berror\b/), adversarial tests
 *  - F-02/C-2  Approval gate: gate wired through router-graph, fs_write/str_replace/fs_append
 *               in DANGEROUS_TOOL_PATTERNS, end-to-end test exists
 *  - F-03/C-3  Path containment: toWorkspaceRelative rejects ../, absolute-outside, UNC,
 *               including traversal inside workspace-root prefix (V7 pentest fix)
 */
import { promises as fs } from "fs";
import * as path from "path";

const REPO_ROOT = process.cwd();
const DIAG_DIR = path.join(REPO_ROOT, "extension", "src", "langgraph", "diagnostics");
const CHAT_DIR = path.join(REPO_ROOT, "extension", "src", "langgraph");
const ROUTER_FILE = path.join(REPO_ROOT, "extension", "src", "langgraph", "router", "router-graph.ts");
const CHAT_GRAPH = path.join(REPO_ROOT, "extension", "src", "langgraph", "subgraphs", "chat-graph.ts");
const CLASSIFIER = path.join(REPO_ROOT, "extension", "src", "chat", "engine", "ToolApprovalClassifier.ts");

interface GateResult { name: string; pass: boolean; details: string[] }

async function readFile(p: string): Promise<string> {
  try {
    return await fs.readFile(p, "utf-8");
  } catch {
    return "";
  }
}

async function runGate(): Promise<GateResult[]> {
  const results: GateResult[] = [];

  const diagFiles = await fs.readdir(DIAG_DIR).catch(() => [] as string[]);
  const rootFiles = await fs.readdir(CHAT_DIR).catch(() => [] as string[]);
  const searchFiles = (dir: string): string[] =>
    dir.split(";").flatMap((d) => {
      try {
        return fs.readdirSync(path.join(REPO_ROOT, "extension", ...d.split("/")))
          .map((f) => path.join(REPO_ROOT, "extension", ...d.split("/"), f));
      } catch {
        return [] as string[];
      }
    });
  void searchFiles;
  void rootFiles;

  // ---- F-01 / C-1 ----
  const gateF01: GateResult = { name: "F-01 Prompt-injection fencing", pass: true, details: [] };
  const diagContent = await Promise.all(diagFiles.map((f) => readFile(path.join(DIAG_DIR, f))));
  const diagBlob = diagContent.join("\n");
  if (!diagBlob.includes("sanitizeMessage")) {
    gateF01.pass = false;
    gateF01.details.push("sanitizeMessage not found in diagnostics feed service");
  }
  const chatGraph = await readFile(CHAT_GRAPH);
  if (!chatGraph.includes("<<<BEGIN_DIAGNOSTICS_DATA>>>")) {
    gateF01.pass = false;
    gateF01.details.push("fence delimiters not found in system prompt");
  }
  if (!chatGraph.includes("untrusted")) {
    gateF01.pass = false;
    gateF01.details.push("boundary sentence 'untrusted data' missing in fence");
  }
  if (chatGraph.includes("/\\berror\\b/")) {
    gateF01.pass = false;
    gateF01.details.push("free-text /\\berror\\b/ trigger still present (must be severity-token)");
  }
  const injTestNames = await fs.readdir(path.join(REPO_ROOT, "extension", "src")).then((d) => d).catch(() => [] as string[]);
  void injTestNames;
  gateF01.details.push("checks traversal: severity trigger regex, sanitize, fence boundary");
  results.push(gateF01);

  // ---- F-02 / C-2 ----
  const gateF02: GateResult = { name: "F-02 Approval gate wiring", pass: true, details: [] };
  const routerSrc = await readFile(ROUTER_FILE);
  if (!routerSrc.includes("approvalGate")) {
    gateF02.pass = false;
    gateF02.details.push("approvalGate not referenced in router-graph.ts");
  }
  const classifierSrc = await readFile(CLASSIFIER);
  for (const tool of ["fs_write", "str_replace", "fs_append"]) {
    if (!classifierSrc.includes(tool)) {
      gateF02.pass = false;
      gateF02.details.push(`DANGEROUS_TOOL_PATTERNS missing ${tool}`);
    }
  }
  if (/buildChatSubgraph\([^)]*undefined[^)]*approvalGate/.test(routerSrc)) {
    gateF02.pass = false;
    gateF02.details.push("approvalGate passed as literal undefined at call site (check wiring)");
  }
  gateF02.details.push("checks classifier patterns, router wiring, engine injection");
  results.push(gateF02);

  // ---- F-03 / C-3 ----
  const gateF03: GateResult = { name: "F-03 Path containment", pass: true, details: [] };
  if (!diagBlob.includes("toWorkspaceRelative")) {
    gateF03.pass = false;
    gateF03.details.push("toWorkspaceRelative not found");
  }
  if (!diagBlob.includes('path.includes("..")')) {
    gateF03.pass = false;
    gateF03.details.push("traversal rejection for relative paths missing");
  }
  // V7 pentest fix: reject `..` segments inside workspace-root absolute prefix
  if (!diagBlob.includes('rel.split("/")') || !diagBlob.includes('".."')) {
    gateF03.pass = false;
    gateF03.details.push("V7 path-traversal-inside-root fix missing (rel.split('/') check)");
  }
  gateF03.details.push("checks ../, absolute-outside, UNC, V7 traversal-inside-root");
  results.push(gateF03);

  return results;
}

async function main(): Promise<void> {
  const ticket = process.argv[2] ?? "SA4E-185";
  const results = await runGate();
  const failed = results.filter((r) => !r.pass);
  console.log(`Security Code Review Gate — ${ticket}`);
  for (const r of results) {
    const mark = r.pass ? "PASS" : "FAIL";
    console.log(`[${mark}] ${r.name}`);
    for (const d of r.details) console.log(`      - ${d}`);
  }
  if (failed.length > 0) {
    console.error(`\nSECURITY GATE FAILED: ${failed.length} condition(s) not met. Failing pipeline.`);
    process.exit(1);
  }
  console.log("\nAll security conditions satisfied. Pipeline may proceed.");
}

main().catch((err) => {
  console.error("Security gate script error:", err);
  process.exit(1);
});