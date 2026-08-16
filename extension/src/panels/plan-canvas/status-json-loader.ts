/**
 * StatusJsonLoader — Scans workspace for STATUS.json files and parses them.
 * SA4E-132: Data access layer (Repository pattern) for pipeline status.
 */

import * as fs from "fs";
import * as path from "path";
import { PipelineStatus } from "./plan-canvas-models";

/** Scan workspace documents folder for STATUS.json files. */
export function findStatusFiles(workspaceRoot: string): string[] {
  const docsDir = path.join(workspaceRoot, "documents");
  if (!fs.existsSync(docsDir)) { return []; }

  const entries = fs.readdirSync(docsDir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) { continue; }
    const statusPath = path.join(docsDir, entry.name, "STATUS.json");
    if (fs.existsSync(statusPath)) { results.push(statusPath); }
  }
  return results;
}

/** Parse a single STATUS.json file into a PipelineStatus. Returns null on failure. */
export function parseStatusFile(filePath: string): PipelineStatus | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    if (!data.ticket || !data.phases) { return null; }
    return {
      ticket: data.ticket,
      currentPhase: data.currentPhase || "",
      phases: data.phases,
      lastUpdated: data.lastUpdated,
    };
  } catch {
    return null;
  }
}

/** Load all STATUS.json files from workspace. */
export function loadAllPipelines(workspaceRoot: string): PipelineStatus[] {
  const files = findStatusFiles(workspaceRoot);
  return files
    .map(parseStatusFile)
    .filter((p): p is PipelineStatus => p !== null);
}
