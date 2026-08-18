/**
 * Reset all enriched symbols so they get re-enriched with updated prompts.
 * Then creates CODE_ENRICHMENT tasks for all eligible symbols.
 */
import pg from 'pg';
import { isPegaKind } from '../src/modules/pega/pega-mapping.js';

const DB_URL = 'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db';
const pool = new pg.Pool({ connectionString: DB_URL });

const ENRICHABLE_KINDS = new Set(['class', 'interface', 'enum', 'function', 'method', 'arrow_function', 'generator']);
function isEligible(kind: string): boolean {
  return ENRICHABLE_KINDS.has(kind) || isPegaKind(kind);
}

async function main() {
  // Step 1: Reset all COMPLETED symbols
  const reset = await pool.query(
    `UPDATE symbols SET enrichment_status = NULL, summary = NULL, pseudo_code = NULL, llm_tags = NULL, enriched_at = NULL
     WHERE enrichment_status = 'COMPLETED'`
  );
  console.log(`Reset ${reset.rowCount} symbols to re-eligible.`);

  // Step 2: Clear existing CODE_ENRICHMENT tasks
  const deleted = await pool.query(`DELETE FROM pending_tasks WHERE task_type = 'CODE_ENRICHMENT'`);
  console.log(`Cleared ${deleted.rowCount} old enrichment tasks.`);

  // Step 3: Create new tasks for all eligible symbols
  const { rows: symbols } = await pool.query(`
    SELECT s.id, s.name, s.kind, f.relative_path as file_path, s.project_id
    FROM symbols s JOIN files f ON s.file_id = f.id
    WHERE s.enrichment_status IS NULL
  `);
  const eligible = symbols.filter(s => isEligible(s.kind));
  console.log(`Found ${symbols.length} unenriched symbols, ${eligible.length} eligible.`);

  let created = 0;
  for (const s of eligible) {
    const payload = JSON.stringify({
      symbolId: s.id, symbolName: s.name, symbolKind: s.kind,
      projectId: s.project_id, filePath: s.file_path,
      workspaceType: isPegaKind(s.kind) ? 'pega' : 'standard',
    });
    await pool.query(
      `INSERT INTO pending_tasks (task_type, entry_id, status, payload, max_retries, created_at)
       VALUES ('CODE_ENRICHMENT', $1, 'PENDING', $2, 3, NOW())`,
      [s.id, payload]
    );
    created++;
  }
  console.log(`Created ${created} enrichment tasks. TaskWorker will process them.`);
  await pool.end();
}
main();
