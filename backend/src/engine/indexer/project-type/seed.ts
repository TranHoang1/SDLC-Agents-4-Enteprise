/**
 * SA4E-108 — Seed project type definitions into KB on first startup.
 * Only ingests if KB has no existing PROJECT_TYPE_CONFIG entries.
 */
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Logger } from 'pino';
import { ProjectTypeConfigSchema } from './models.js';
import type { KBSearchFn } from './detector.js';
import type { KBIngestFn } from './discovery.js';

const __dirname2 = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(__dirname2, '../../../data/project-type-seeds.json');

/**
 * Seeds KB with 15 project type definitions if none exist.
 * Called once during server startup.
 */
export async function seedProjectTypes(
  kbSearch: KBSearchFn,
  kbIngest: KBIngestFn,
  logger: Logger,
): Promise<void> {
  // Skip if KB already has configs
  const existing = await kbSearch('project-type-config', { type: 'ARCHITECTURE', limit: 1 });
  if (existing.length > 0) {
    logger.debug('KB has project type configs — skip seed');
    return;
  }

  // Load + validate + ingest
  let seeds: unknown[];
  try {
    seeds = JSON.parse(await readFile(SEED_FILE, 'utf-8'));
  } catch (err) {
    logger.warn({ err }, 'Failed to read seed file');
    return;
  }

  let count = 0;
  for (const seed of seeds) {
    const parsed = ProjectTypeConfigSchema.safeParse(seed);
    if (!parsed.success) continue;
    await kbIngest(JSON.stringify(parsed.data), {
      type: 'ARCHITECTURE',
      tags: `project-type-config,${parsed.data.type_id},seed`,
      scope: 'PROJECT',
    });
    count++;
  }
  logger.info({ count }, '🌱 Seeded project type definitions into KB');
}
