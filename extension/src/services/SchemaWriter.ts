/**
 * SchemaWriter — Handles file I/O for generated JSON Schema files (SA4E-93).
 * Creates directory if missing (AF-04), overwrites on re-run (BR-07 idempotency).
 */

import * as vscode from "vscode";
import * as path from "path";
import type { JsonSchema } from "../models";

/** Characters allowed in schema filenames */
const SAFE_FILENAME_RE = /[^a-zA-Z0-9_\-.]/g;

export class SchemaWriter {
  /**
   * Write a JSON Schema to disk at schemas/auto/{ruleType}.json.
   * @param ruleType Pega pxObjClass (used for filename)
   * @param schema Complete JSON Schema object
   * @param workspaceRoot Workspace root path
   * @throws Error if file I/O fails
   */
  public async writeSchema(
    ruleType: string,
    schema: JsonSchema,
    workspaceRoot: string,
  ): Promise<void> {
    const dirPath = path.join(workspaceRoot, "schemas", "auto");
    await this.ensureDirectory(dirPath);
    const fileName = this.sanitizeFileName(ruleType) + ".json";
    const filePath = path.join(dirPath, fileName);
    const content = JSON.stringify(schema, null, 2);
    const uri = vscode.Uri.file(filePath);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
  }

  /**
   * Sanitize pxObjClass for use as filename (BR-09).
   * Preserves casing, replaces unsafe characters with "-".
   * @param ruleType Raw pxObjClass string
   * @returns Safe filename (without extension)
   */
  public sanitizeFileName(ruleType: string): string {
    return ruleType.replace(SAFE_FILENAME_RE, "-").replace(/-{2,}/g, "-");
  }

  /**
   * Get the output directory path for schema files.
   * @param workspaceRoot Workspace root path
   * @returns Absolute path to schemas/auto/
   */
  public getOutputDirectory(workspaceRoot: string): string {
    return path.join(workspaceRoot, "schemas", "auto");
  }

  /** Ensure schemas/auto/ directory exists (AF-04) */
  private async ensureDirectory(dirPath: string): Promise<void> {
    const uri = vscode.Uri.file(dirPath);
    await vscode.workspace.fs.createDirectory(uri);
  }
}
