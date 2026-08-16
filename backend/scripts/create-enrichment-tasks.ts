/**
 * SA4E-171: Create CODE_ENRICHMENT tasks for all unenriched symbols.
 * Connects directly to PostgreSQL to avoid adapter bootstrapping issues.
 * Run: npx tsx scripts/create-enrichment-tasks.ts
 */
import pg from 'pg';
import { isPegaKind } from '../src/modules/pega/pega-mapping.js';

const DB_URL = process.env.DATABASE_URL || 'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db';
const pool = new pg.Pool({ connectionString: DB_URL });

const ENRICHABLE_KINDS = new Set(['class', 'interface', 'enum', 'function', 'method', 'arrow_function', 'generator']);

function isEligible(kind: string): boolean {
  return ENRICHABLE_KINDS.has(kind) || isPegaKind(kind);
}

async function main() {
  // Find unenriched symbols
  const { rows: symbols } = await pool.query(`
    SELECT s.id, s.name, s.kind, f.relative_path as file_path, s.project_id
    FROM symbols s JOIN files f ON s.file_id = f.id
    WHERE s.enrichment_status IS NULL OR s.enrichment_status = 'FAILED'
       OR (s.enrichment_status = 'COMPLETED' AND s.summary IS NULL)
  `);

  console.log(`Found ${symbols.length} unenriched symbols`);

  // Filter eligible kinds
  const eligible = symbols.filter(s => isEligible(s.kind));
  console.log(`Eligible for enrichment: ${eligible.length}`);

  if (eligible.length === 0) {
    console.log('Nothing to do.');
    await pool.end();
    process.exit(0);
  }

  // Insert tasks in batches
  let created = 0;
  const BATCH = 100;
  for (let i = 0; i < eligible.length; i += BATCH) {
    const batch = eligible.slice(i, i + BATCH);
    for (const sym of batch) {
      const payload = JSON.stringify({
        symbolId: sym.id,
        symbolName: sym.name,
        symbolKind: sym.kind,
        projectId: sym.project_id,
        filePath: sym.file_path,
        workspaceType: isPegaKind(sym.kind) ? 'pega' : 'standard',
      });
      await pool.query(
        `INSERT INTO pending_tasks (task_type, entry_id, status, payload, max_retries, project_id, created_at)
         VALUES ('CODE_ENRICHMENT', $1, 'PENDING', $2, 3, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [sym.id, payload, sym.project_id],
      );
      created++;
    }
    console.log(`Created ${Math.min(i + BATCH, eligible.length)}/${eligible.length} tasks`);
  }

  console.log(`\nDone: ${created} enrichment tasks created.`);
  console.log('TaskWorker will now process them automatically.');
  await pool.end();
  process.exit(0);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
