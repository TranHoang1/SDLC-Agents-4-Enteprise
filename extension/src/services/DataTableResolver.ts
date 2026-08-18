/**
 * DataTableResolver — Post-processing step: resolve DataTable + Database rules
 * from indexed Rule-Obj-Class definitions (SA4E-172).
 * Pattern: Facade — orchestrates key computation, fetch, save, ingest.
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as vscode from "vscode";
import type { PegaHttpClient } from "./PegaHttpClient";
import type { PegaStreamIngester } from "./PegaStreamIngester";
import { saveRuleFile } from "./PegaCrawlHelper";
import { computeDataTableKey, computeDatabaseKey, isCriticalError } from "./DataTableKeyComputer";
import type { ClassRuleInput, DataTableResolveResult, DataTableRuleInfo } from "../models/DataTableModels";

type ProgressReporter = vscode.Progress<{ message?: string }>;
type LogFn = (msg: string) => void;

export { computeDataTableKey, computeDatabaseKey, isCriticalError } from "./DataTableKeyComputer";

/** Resolves DataTable and Database rules from indexed class definitions. */
export class DataTableResolver {
  constructor(
    private readonly pegaClient: PegaHttpClient,
    private readonly ingester: PegaStreamIngester,
    private readonly log: LogFn,
  ) {}

  /**
   * Orchestrates full DataTable + Database resolution.
   * @param projectId - 12-char hex project identifier
   * @param root - Workspace root for reading/saving rule files
   * @param report - VS Code progress reporter
   * @returns Summary counts
   * @throws Error on critical HTTP failures (401/403/5xx)
   */
  async resolve(
    projectId: string,
    root: string,
    report: ProgressReporter,
  ): Promise<DataTableResolveResult> {
    const result: DataTableResolveResult = {
      dataTablesResolved: 0, databasesResolved: 0,
      skippedAbstract: 0, skippedNotFound: 0, errors: 0,
    };

    this.log(`[DataTableResolver] 🚀 Starting DataTable resolution. Root: ${root}, ProjectId: ${projectId}`);
    const classRules = this.scanClassFiles(root);
    this.log(`[DataTableResolver] 🔍 Found ${classRules.length} Rule-Obj-Class files`);

    const { tableKeys, skippedAbstract } = this.buildTableKeyMap(classRules);
    result.skippedAbstract = skippedAbstract;

    // Phase 1: Fetch DataTable rules
    const tableInfos = await this.fetchDataTables(tableKeys, root, projectId, report, result);

    // Phase 2: Fetch Database rules from resolved DataTables
    await this.fetchDatabases(tableInfos, root, projectId, report, result);

    this.log(`[DataTableResolver] ✅ Resolved ${result.dataTablesResolved} tables, ${result.databasesResolved} databases`);
    return result;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  /** Scan disk for Rule-Obj-Class .pega.json files and parse minimal fields */
  private scanClassFiles(root: string): ClassRuleInput[] {
    const classDir = path.join(root, "rules", "Rule-Obj-Class");
    this.log(`[DataTableResolver] 🔍 Scanning class files at: ${classDir}`);
    if (!fs.existsSync(classDir)) {
      this.log(`[DataTableResolver] ⚠️ Directory not found: ${classDir}. Skipping DataTable resolution.`);
      return [];
    }

    const files = fs.readdirSync(classDir).filter(f => f.endsWith(".pega.json"));
    const results: ClassRuleInput[] = [];

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(classDir, file), "utf-8");
        const json = JSON.parse(raw) as Record<string, unknown>;
        results.push(this.parseClassRule(json));
      } catch (err: any) {
        this.log(`[DataTableResolver] ⚠️ Parse error in ${file}: ${err.message}. Skipping.`);
      }
    }
    return results;
  }

  /** Extract ClassRuleInput fields from raw rule JSON */
  private parseClassRule(json: Record<string, unknown>): ClassRuleInput {
    return {
      pzInsKey: String(json.pzInsKey || ""),
      pyClassName: String(json.pyClassName || ""),
      pyClassType: String(json.pyClassType || ""),
      pyClassGroupIndicator: String(json.pyClassGroupIndicator || ""),
      pyClassGroup: json.pyClassGroup ? String(json.pyClassGroup) : undefined,
      pyDerivesFrom: json.pyDerivesFrom ? String(json.pyDerivesFrom) : undefined,
    };
  }

  /** Build deduplicated map of DataTable keys → source class names */
  private buildTableKeyMap(classRules: ClassRuleInput[]): {
    tableKeys: Map<string, string[]>; skippedAbstract: number;
  } {
    const tableKeys = new Map<string, string[]>();
    let skippedAbstract = 0;

    for (const rule of classRules) {
      const key = computeDataTableKey(rule);
      if (key === null) {
        // BR-03: Abstract classes return null from computeDataTableKey
        if (rule.pyClassType === "Abstract") { skippedAbstract++; }
        continue;
      }
      // BR-04: Deduplicate — multiple classes may map to same DataTable
      const sources = tableKeys.get(key) || [];
      sources.push(rule.pyClassName);
      tableKeys.set(key, sources);
    }
    return { tableKeys, skippedAbstract };
  }

  /** Fetch all unique DataTable rules, save to disk, ingest into KB */
  private async fetchDataTables(
    tableKeys: Map<string, string[]>, root: string,
    projectId: string, report: ProgressReporter, result: DataTableResolveResult,
  ): Promise<DataTableRuleInfo[]> {
    const total = tableKeys.size;
    const infos: DataTableRuleInfo[] = [];
    let idx = 0;

    for (const [insKey, sourceClasses] of tableKeys) {
      idx++;
      report.report({ message: `Resolving DataTables: ${idx}/${total}` });

      const ruleJson = await this.fetchAndSaveRule(insKey, root);
      if (!ruleJson) { result.skippedNotFound++; continue; }

      await this.ingestRule(projectId, ruleJson);
      result.dataTablesResolved++;

      const dbName = ruleJson.pyDatabaseName ? String(ruleJson.pyDatabaseName) : undefined;
      infos.push({ pzInsKey: insKey, pyDatabaseName: dbName, ruleJson, sourceClasses });
    }
    return infos;
  }

  /** Fetch all unique Database rules derived from fetched DataTables */
  private async fetchDatabases(
    tableInfos: DataTableRuleInfo[], root: string,
    projectId: string, report: ProgressReporter, result: DataTableResolveResult,
  ): Promise<void> {
    const dbKeys = new Map<string, string[]>();
    for (const info of tableInfos) {
      if (!info.pyDatabaseName) { continue; }
      const key = computeDatabaseKey(info.pyDatabaseName);
      if (!key) { continue; }
      const sources = dbKeys.get(key) || [];
      sources.push(info.pzInsKey);
      dbKeys.set(key, sources);
    }

    const total = dbKeys.size;
    let idx = 0;
    for (const [insKey] of dbKeys) {
      idx++;
      report.report({ message: `Resolving Databases: ${idx}/${total}` });

      const ruleJson = await this.fetchAndSaveRule(insKey, root);
      if (!ruleJson) { result.skippedNotFound++; continue; }

      await this.ingestRule(projectId, ruleJson);
      result.databasesResolved++;
    }
  }

  /** Fetch a rule by insKey and save to disk. Returns null if not found. */
  private async fetchAndSaveRule(
    insKey: string, root: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const ruleJson = await this.pegaClient.getRuleByInsKey(insKey);
      saveRuleFile(ruleJson, root, this.log);
      return ruleJson;
    } catch (err: any) {
      if (isCriticalError(err)) { throw err; }
      this.log(`[DataTableResolver] ⚠️ ${err.message}. Skipping.`);
      return null;
    }
  }

  /** Ingest a single rule into KB backend via PegaStreamIngester */
  private async ingestRule(
    projectId: string, ruleJson: Record<string, unknown>,
  ): Promise<void> {
    try {
      const checksum = crypto.createHash("sha256").update(JSON.stringify(ruleJson)).digest("hex");
      await this.ingester.ingestSingleRule(projectId, ruleJson, checksum);
    } catch (err: any) {
      this.log(`[DataTableResolver] ⚠️ Ingest error: ${err.message}. Continuing.`);
    }
  }
}
