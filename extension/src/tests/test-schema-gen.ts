/**
 * SA4E-95: Test PegaSchemaGenerator — generate JSON schema for pzAccessGroups.
 * Run: npx tsx extension/src/test-schema-gen.ts
 */

import { PegaBrowserInspector } from "../services/PegaBrowserInspector";
import { PegaSchemaGenerator } from "../services/PegaSchemaGenerator";
import * as fs from "fs";

const LOG_FILE = "extension/src/schema-gen.log";

/** Write to both console (summary) and log file (detail) */
function log(msg: string) {
  fs.appendFileSync(LOG_FILE, msg + "\n");
  // Only print progress lines to console
  if (msg.includes("[SchemaGen] [") || msg.includes("✅") || msg.includes("❌") || msg.includes("Tab close")) {
    console.log(msg);
  }
}

async function main() {
  // Clear log file
  fs.writeFileSync(LOG_FILE, `Schema Gen Log — ${new Date().toISOString()}\n${"=".repeat(60)}\n`);

  const pegaEndpoint = process.env.PEGA_URL || "https://zdk8budo.pegaacademy.net/prweb";
  const username = process.env.PEGA_USER || "";
  const password = process.env.PEGA_PASS || "";

  if (!username || !password) {
    console.error("Set PEGA_USER and PEGA_PASS env vars.");
    process.exit(1);
  }

  const inspector = new PegaBrowserInspector(
    { pegaEndpoint, username, password, headless: false, timeout: 45_000 },
    (msg) => log(msg),
  );

  try {
    await inspector.launch();
    await inspector.login();

    const generator = new PegaSchemaGenerator(
      { pegaEndpoint, username, password, maxDepth: 3 },
      inspector,
      (msg) => log(msg),
    );

    console.log("\n" + "=".repeat(60));
    console.log("GENERATING JSON SCHEMA (sequential, first 10 sections)");
    console.log("=".repeat(60));

    const result = await generator.generateFromSection("Data-Admin-Operator-ID", "pzGeneralFields");

    console.log("\n" + "=".repeat(60));
    console.log("SCHEMA TREE");
    console.log("=".repeat(60));
    printNode(result.schema, "");

    const jsonSchema = generator.toJsonSchema(result);
    console.log("\n" + "=".repeat(60));
    console.log("JSON SCHEMA");
    console.log("=".repeat(60));
    console.log(JSON.stringify(jsonSchema, null, 2));

    console.log("\n" + "=".repeat(60));
    console.log(`Props: ${result.metadata.totalProperties} | Sections: ${result.metadata.totalSections} | ${result.metadata.durationMs}ms`);

    // Save schema to file for baseline testing
    const outPath = "extension/src/test-schema-output.json";
    fs.writeFileSync(outPath, JSON.stringify(jsonSchema, null, 2));
    console.log(`\n✅ Schema saved to: ${outPath}`);

    console.log("\n10s...");
    await new Promise((r) => setTimeout(r, 10_000));
  } catch (err: any) {
    console.error(err.message);
    console.error(err.stack);
  } finally {
    await inspector.close();
    console.log("Done.");
  }
}

function printNode(node: any, indent: string) {
  console.log(`${indent}${node.className}${node.sectionName ? ` [${node.sectionName}]` : ""}`);
  for (const p of node.properties || []) {
    const extra = p.pageClass ? ` → ${p.pageClass}` : "";
    console.log(`${indent}  ├─ ${p.name}: ${p.type} (${p.pegaType})${extra}${p.label ? ` "${p.label}"` : ""}`);
    if (p.items) printNode(p.items, indent + "  │  ");
    if (p.properties) printNode(p.properties, indent + "  │  ");
  }
}

main();
