/**
 * SA4E-193 — FileWriter (C4): workspace persistence for generated configs
 * (L-IO error layer, BR-06/BR-16).
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Write file with automatic parent directory creation.
 * ONE writeFile call => the SA4E-189 hot-reload debounce (300 ms) never
 * observes partial content (PL-4 contract, FSD §6.6.3).
 */
export async function writeFileWithMkdir(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, content, "utf-8");
}

/**
 * ERR-CMD-06 collision check STUB (BR-12 / GAP-05 / OI-01).
 *
 * The overwrite policy (confirm-or-rename vs warn-and-proceed) is pending PO
 * confirmation, so this only DETECTS collisions; the handler surfaces a
 * non-blocking warning and logs. Silent-overwrite policy decision lands in a
 * follow-up ticket once OI-01 is resolved.
 */
export async function targetExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (err) {
    console.debug("[FileWriter] no collision at:", filePath, (err as Error).message);
    return false;
  }
}
