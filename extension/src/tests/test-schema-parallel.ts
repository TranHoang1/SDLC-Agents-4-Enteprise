/**
 * SA4E-95: Parallel schema generation — N browser workers processing sections concurrently.
 * Each worker: separate Chrome instance + login + own log file.
 * Run: npx tsx extension/src/test-schema-parallel.ts
 */

import { PegaBrowserInspector } from "../services/PegaBrowserInspector";
import { PegaSchemaGenerator } from "../services/PegaSchemaGenerator";
import type { SchemaProperty } from "../services/PegaSchemaGenerator";
import * as fs from "fs";

const WORKER_COUNT = 20;
const LOG_DIR = "extension/src/logs";
const OUTPUT_FILE = "extension/src/test-schema-output.json";

interface WorkerResult {
  workerId: number;
  properties: SchemaProperty[];
  errors: string[];
  sectionStats: { name: string; props: number }[];
  durationMs: number;
}

async function main() {
  const pegaEndpoint = process.env.PEGA_URL || "https://zdk8budo.pegaacademy.net/prweb";
  const username = process.env.PEGA_USER || "";
  const password = process.env.PEGA_PASS || "";

  if (!username || !password) {
    console.error("Set PEGA_USER and PEGA_PASS env vars.");
    process.exit(1);
  }

  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

  console.log(`\nPARALLEL SCHEMA GEN — ${WORKER_COUNT} workers`);

  // Step 1: Get section list
  console.log("Fetching sections...");
  const sections = await listSections(pegaEndpoint, username, password);
  console.log(`Found ${sections.length} sections`);

  // Step 2: Distribute
  const chunks: string[][] = Array.from({ length: WORKER_COUNT }, () => []);
  sections.forEach((s, i) => chunks[i % WORKER_COUNT].push(s));
  chunks.forEach((c, i) => console.log(`  W${i}: ${c.length} sections`));

  // Step 3: Launch parallel
  console.log("\nStarting...");
  const startTime = Date.now();
  const results = await Promise.all(
    chunks.map((chunk, i) => runWorker(i, chunk, pegaEndpoint, username, password)),
  );

  // Step 4: Merge
  const allProps: SchemaProperty[] = [];
  const seen = new Set<string>();
  let totalErrors = 0;

  for (const r of results) {
    for (const p of r.properties) {
      if (!seen.has(p.name)) { seen.add(p.name); allProps.push(p); }
      else if (p.required) { const ex = allProps.find((x) => x.name === p.name); if (ex) ex.required = true; }
    }
    totalErrors += r.errors.length;
  }

  // Step 5: Output
  const requiredProps = allProps.filter((p) => p.required).map((p) => p.name);
  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Data-Admin-Operator-ID",
    type: "object",
    properties: Object.fromEntries(allProps.map((p) => [p.name, {
      type: p.type, description: p.label || p.pegaType,
      ...(p.pageClass ? { "x-pega-class": p.pageClass } : {}),
      ...(p.items ? { items: { type: "object", "x-pega-class": p.items.className } } : {}),
    }])),
    ...(requiredProps.length > 0 ? { required: requiredProps } : {}),
    "x-metadata": {
      properties: allProps.length, sections: sections.length,
      workers: WORKER_COUNT, errors: totalErrors,
      required: requiredProps.length,
      durationMs: Date.now() - startTime, at: new Date().toISOString(),
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(schema, null, 2));
  console.log(`\nDONE: ${allProps.length} props, ${totalErrors} errors, ${((Date.now()-startTime)/1000).toFixed(0)}s`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Logs: ${LOG_DIR}/worker-*.log`);

  // Section statistics
  const allStats = results.flatMap((r) => r.sectionStats);
  const emptyOnes = allStats.filter((s) => s.props === 0);
  const withProps = allStats.filter((s) => s.props > 0);
  console.log(`\n--- SECTION STATS ---`);
  console.log(`Sections with properties: ${withProps.length}/${allStats.length}`);
  console.log(`Sections with 0 properties: ${emptyOnes.length}`);
  if (emptyOnes.length > 0) {
    console.log(`\n⚠️ Sections returning 0 properties:`);
    for (const s of emptyOnes) { console.log(`  - ${s.name}`); }
  }
  console.log(`\n--- TOP sections by property count ---`);
  const sorted = [...allStats].sort((a, b) => b.props - a.props);
  for (const s of sorted.slice(0, 10)) {
    console.log(`  ${s.name}: ${s.props} props`);
  }

  // Save stats to file
  const statsFile = `${LOG_DIR}/section-stats.json`;
  fs.writeFileSync(statsFile, JSON.stringify({ total: allStats.length, withProps: withProps.length, empty: emptyOnes, topSections: sorted.slice(0, 20) }, null, 2));
  console.log(`\nStats: ${statsFile}`);
}

async function runWorker(
  id: number, sections: string[],
  pegaEndpoint: string, username: string, password: string,
): Promise<WorkerResult> {
  const logFile = `${LOG_DIR}/worker-${id}.log`;
  fs.writeFileSync(logFile, `W${id} — ${sections.length} sections\n`);
  const wlog = (msg: string) => fs.appendFileSync(logFile, msg + "\n");

  const startTime = Date.now();
  const properties: SchemaProperty[] = [];
  const errors: string[] = [];
  const sectionStats: { name: string; props: number }[] = [];

  const inspector = new PegaBrowserInspector(
    { pegaEndpoint, username, password, headless: true, timeout: 30_000 },
    wlog,
  );

  try {
    await inspector.launch();
    await inspector.login();

    const gen = new PegaSchemaGenerator(
      { pegaEndpoint, username, password }, inspector, wlog,
    );

    for (let i = 0; i < sections.length; i++) {
      const name = sections[i];
      console.log(`[W${id}] [${i+1}/${sections.length}] ${name}`);
      wlog(`[${i+1}/${sections.length}] ${name}`);

      try {
        const result = await gen.generateFromSection("Data-Admin-Operator-ID", name);
        for (const p of result.schema.properties) properties.push(p);
        sectionStats.push({ name, props: result.schema.properties.length });
        wlog(`  OK: ${result.schema.properties.length} props`);
      } catch (err: any) {
        errors.push(`${name}: ${err.message}`);
        wlog(`  ERR: ${err.message}`);
      }
    }
  } catch (err: any) {
    errors.push(`W${id} fatal: ${err.message}`);
    wlog(`FATAL: ${err.message}`);
  } finally {
    await inspector.close();
  }

  wlog(`\nDone: ${properties.length} props, ${errors.length} errs, ${Date.now()-startTime}ms`);
  return { workerId: id, properties, errors, sectionStats, durationMs: Date.now() - startTime };
}

async function listSections(ep: string, user: string, pass: string): Promise<string[]> {
  const base = ep.replace(/\/PRServlet$/, "").replace(/\/prweb$/, "");
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  const sections = new Set<string>();
  let page = 1;
  let more = true;
  while (more) {
    const url = `${base}/prweb/api/CodeIntelligence/v1/rules/listRules?ObjClass=Rule-HTML-Section&FilterPropName=pyClassName&FilterPropValue=Data-Admin-Operator-ID&PageSize=50&PageIndex=${page}`;
    const r = await fetch(url, { method: "POST", headers: { Authorization: auth } });
    if (!r.ok) break;
    const j = await r.json() as any;
    for (const x of j.pxResults || []) { if (x.pyStreamName) sections.add(x.pyStreamName); }
    more = (j.pxResults || []).length >= 50;
    page++;
  }
  return Array.from(sections);
}

main();
