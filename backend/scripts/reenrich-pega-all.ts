/**
 * One-off (SA4E): Reset + re-queue enrichment for ALL Pega rule symbols so the
 * corrected extractor + grounded prompt regenerate accurate summary + pseudo code.
 *
 * Matching is by FQN (pxObjClass:pyClassName:pyRuleName), scanning every
 * *.pega.json under RULES_ROOT recursively — kind-agnostic, so it also covers
 * the large pega_unknown bucket. Uses the production primitive
 * refreshRuleSymbolBody() so behavior matches real indexing exactly.
 *
 * Usage (from backend/):
 *   $env:PGPASSWORD_OVERRIDE="..."; npx tsx scripts/reenrich-pega-all.ts [--limit N] [--offset N] [--apply]
 *   (no --apply = dry run: reports match/unmatched counts, writes nothing)
 */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { DatabaseAdapterFactory } from '../src/database/factory/DatabaseAdapterFactory.js';
import { refreshRuleSymbolBody } from '../src/modules/pega/PegaSymbolSync.js';
import { buildFqn, resolveRuleNameField, resolveRuleSetName, resolveRuleSetVersion } from '../src/modules/pega/pega-mapping.js';

/** Root folder holding exported Pega rule JSON (one subfolder per rule type). */
const RULES_ROOT = 'c:\\projects\\Pega\\HRv2\\rules';

interface Args { limit: number; offset: number; apply: boolean; kind?: string; }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (flag: string) => { const i = a.indexOf(flag); return i >= 0 ? a[i + 1] : undefined; };
  return {
    limit: parseInt(get('--limit') || '100000', 10),
    offset: parseInt(get('--offset') || '0', 10),
    apply: a.includes('--apply'),
    kind: get('--kind'),  // optional: restrict to a single pega kind (e.g. pega_rule_obj_flow)
  };
}

/** Recursively collect every *.pega.json path under a directory. */
async function collectRuleFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import('node:fs').Dirent[] = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await collectRuleFiles(full));
    else if (e.name.endsWith('.pega.json')) out.push(full);
  }
  return out;
}

/** Build an FQN→ruleJson index from all rule files on disk. */
async function indexRuleFilesByFqn(): Promise<Map<string, Record<string, unknown>>> {
  const index = new Map<string, Record<string, unknown>>();
  const files = await collectRuleFiles(RULES_ROOT);
  for (const file of files) {
    try {
      const json = JSON.parse(await fs.readFile(file, 'utf-8')) as Record<string, unknown>;
      const px = String(json.pxObjClass || '');
      const cls = String(json.pyClassName || '');
      const name = resolveRuleNameField(json);
      const rs = resolveRuleSetName(json);
      const ver = resolveRuleSetVersion(json);
      if (px && cls && name) index.set(buildFqn(px, cls, name, rs, ver), json);
    } catch { /* skip bad JSON */ }
  }
  return index;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const password = process.env.PGPASSWORD_OVERRIDE || '';
  if (!password) throw new Error('Set PGPASSWORD_OVERRIDE with the postgres password.');

  const adapter = DatabaseAdapterFactory.create({
    engine: 'postgresql', host: 'localhost', port: 5432,
    username: 'sa4e_user', password, database: 'sa4e_db', ssl: false,
  });
  await (adapter as any).connect?.();

  const symbols = args.kind
    ? await adapter.allAsync<{ id: number; signature: string; project_id: string; kind: string }>(
        `SELECT id, signature, project_id, kind FROM symbols WHERE kind = $1 ORDER BY id`, [args.kind])
    : await adapter.allAsync<{ id: number; signature: string; project_id: string; kind: string }>(
        `SELECT id, signature, project_id, kind FROM symbols WHERE kind LIKE 'pega_%' ORDER BY id`);
  console.log(`[info] pega symbols in DB${args.kind ? ` (kind=${args.kind})` : ''}: ${symbols.length}`);

  const fqnIndex = await indexRuleFilesByFqn();
  console.log(`[info] on-disk rule JSON indexed by FQN: ${fqnIndex.size}`);

  const matched = symbols.filter(s => fqnIndex.has(s.signature));
  const unmatched = symbols.filter(s => !fqnIndex.has(s.signature));
  console.log(`[info] matched=${matched.length} unmatched=${unmatched.length}`);
  if (unmatched.length) {
    console.log('[info] sample unmatched (need live re-crawl):',
      unmatched.slice(0, 15).map(s => `${s.kind}:${s.signature}`));
  }

  const batch = matched.slice(args.offset, args.offset + args.limit);
  console.log(`[info] ${args.apply ? 'APPLYING' : 'DRY-RUN (no writes)'} on ${batch.length} symbols (offset=${args.offset} limit=${args.limit})`);

  let done = 0;
  for (const s of batch) {
    const rule = fqnIndex.get(s.signature)!;
    if (!args.apply) { done++; continue; }
    try {
      await refreshRuleSymbolBody(adapter, rule, s.id, s.project_id);
      done++;
      if (done % 100 === 0) console.log(`  ...refreshed ${done}/${batch.length}`);
    } catch (err) {
      console.error(`  [error] id=${s.id} ${s.signature}:`, (err as Error).message);
    }
  }
  console.log(`[info] ${args.apply ? 'refreshed' : 'would refresh'} ${done} symbols`);

  await (adapter as any).disconnect?.();
  console.log('[done]');
}

main().catch(err => { console.error(err); process.exit(1); });
