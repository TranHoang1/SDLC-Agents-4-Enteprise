/**
 * One-off (SA4E): Re-extract body + reset + re-queue enrichment for declarative
 * Pega rules (Declare-Expression, When) whose pseudo code was hallucinated because
 * the old extractor never captured their nested formula/conditions.
 *
 * Uses the SAME production primitive refreshRuleSymbolBody() so behavior matches
 * the real indexing pipeline exactly. Re-enrichment itself is performed by the
 * running backend TaskWorker (this script only refreshes body + requeues).
 *
 * Usage (from backend/):
 *   $env:PGPASSWORD_OVERRIDE="..."; npx tsx scripts/reenrich-pega-declarative.ts [--limit N] [--kinds k1,k2] [--apply]
 *   --limit N      Max symbols to process (default 5 = dry-run batch).
 *   --kinds        Comma list of pega kinds (default pega_declare_expression,pega_when).
 *   --apply        Without this flag the script only reports matches (no writes).
 */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { DatabaseAdapterFactory } from '../src/database/factory/DatabaseAdapterFactory.js';
import { refreshRuleSymbolBody } from '../src/modules/pega/PegaSymbolSync.js';
import { buildFqn, resolveRuleNameField } from '../src/modules/pega/pega-mapping.js';

/** Root folder holding exported Pega rule JSON, one subfolder per rule type. */
const RULES_ROOT = 'c:\\projects\\Pega\\HRv2\\rules';
/** Map pega kind → on-disk rule-type folder name. */
const KIND_TO_FOLDER: Record<string, string> = {
  pega_declare_expression: 'Rule-Declare-Expressions',
  pega_when: 'Rule-Obj-When',
};

interface Args { limit: number; kinds: string[]; apply: boolean; }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (flag: string) => { const i = a.indexOf(flag); return i >= 0 ? a[i + 1] : undefined; };
  return {
    limit: parseInt(get('--limit') || '5', 10),
    kinds: (get('--kinds') || 'pega_declare_expression,pega_when').split(','),
    apply: a.includes('--apply'),
  };
}

/** Build an FQN→ruleJson index by reading every JSON file for the given kinds. */
async function indexRuleFilesByFqn(kinds: string[]): Promise<Map<string, Record<string, unknown>>> {
  const index = new Map<string, Record<string, unknown>>();
  for (const kind of kinds) {
    const folder = KIND_TO_FOLDER[kind];
    if (!folder) continue;
    const dir = path.join(RULES_ROOT, folder);
    let files: string[] = [];
    try { files = (await fs.readdir(dir)).filter(f => f.endsWith('.pega.json')); }
    catch { console.warn(`[warn] cannot read folder ${dir}`); continue; }
    for (const file of files) {
      try {
        const json = JSON.parse(await fs.readFile(path.join(dir, file), 'utf-8')) as Record<string, unknown>;
        const px = String(json.pxObjClass || '');
        const cls = String(json.pyClassName || '');
        const name = resolveRuleNameField(json);
        if (px && cls && name) index.set(buildFqn(px, cls, name), json);
      } catch { console.warn(`[warn] bad JSON: ${file}`); }
    }
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

  const placeholders = args.kinds.map((_, i) => `$${i + 1}`).join(',');
  const symbols = await adapter.allAsync<{ id: number; signature: string; project_id: string }>(
    `SELECT id, signature, project_id FROM symbols WHERE kind IN (${placeholders}) ORDER BY id`,
    args.kinds,
  );
  console.log(`[info] DB symbols for kinds [${args.kinds.join(', ')}]: ${symbols.length}`);

  const fqnIndex = await indexRuleFilesByFqn(args.kinds);
  console.log(`[info] on-disk rule JSON indexed by FQN: ${fqnIndex.size}`);

  const matched = symbols.filter(s => fqnIndex.has(s.signature));
  const unmatched = symbols.filter(s => !fqnIndex.has(s.signature));
  console.log(`[info] matched=${matched.length} unmatched=${unmatched.length}`);
  if (unmatched.length) console.log('[info] unmatched FQNs (need live re-crawl):', unmatched.slice(0, 20).map(s => s.signature));

  const batch = matched.slice(0, args.limit);
  console.log(`[info] ${args.apply ? 'APPLYING' : 'DRY-RUN (no writes)'} on ${batch.length} symbols (limit=${args.limit})`);

  for (const s of batch) {
    const rule = fqnIndex.get(s.signature)!;
    if (!args.apply) { console.log(`  would refresh id=${s.id} ${s.signature}`); continue; }
    await refreshRuleSymbolBody(adapter, rule, s.id, s.project_id);
    console.log(`  refreshed id=${s.id} ${s.signature}`);
  }

  await (adapter as any).disconnect?.();
  console.log('[done]');
}

main().catch(err => { console.error(err); process.exit(1); });
