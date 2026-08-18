/**
 * Fix stale graph nodes that reference deleted symbols.
 * Deletes graph_nodes where entry_id='code:X' but symbol X no longer exists.
 * Also assigns Fibonacci sphere positions to nodes at (0,0,0).
 * Safe: only removes visualization nodes, not actual data.
 */
import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db' });

/** Fibonacci-sphere position distribution. */
function fibonacciSphere(index: number, total: number): { x: number; y: number; z: number } {
  const golden = (1 + Math.sqrt(5)) / 2;
  const theta = 2 * Math.PI * index / golden;
  const phi = Math.acos(1 - 2 * (index + 0.5) / Math.max(total, 1));
  const radius = 800;
  return {
    x: Math.round(radius * Math.sin(phi) * Math.cos(theta) * 100) / 100,
    y: Math.round(radius * Math.sin(phi) * Math.sin(theta) * 100) / 100,
    z: Math.round(radius * Math.cos(phi) * 100) / 100,
  };
}

async function main() {
  // Step 1: Delete stale code nodes
  const result = await pool.query(
    `DELETE FROM graph_nodes 
     WHERE entry_id LIKE 'code:%' 
     AND CAST(REPLACE(entry_id, 'code:', '') AS INTEGER) NOT IN (SELECT id FROM symbols)`
  );
  console.log(`Deleted ${result.rowCount} stale graph nodes.`);

  // Step 2: Insert missing nodes from current symbols (with positions)
  const { rows: missing } = await pool.query(
    `SELECT s.id, s.name, s.kind, s.project_id
     FROM symbols s
     WHERE NOT EXISTS (SELECT 1 FROM graph_nodes g WHERE g.entry_id = 'code:' || s.id)
       AND s.kind NOT IN ('property', 'variable', 'constant', 'type', 'constructor')`
  );
  console.log(`Found ${missing.length} missing symbols to add as graph nodes.`);
  for (let i = 0; i < missing.length; i++) {
    const s = missing[i];
    const pos = fibonacciSphere(i, missing.length);
    const type = s.kind.replace('pega_', '').toUpperCase();
    await pool.query(
      `INSERT INTO graph_nodes (entry_id, label, type, tier, project_id, x, y, z)
       VALUES ($1, $2, $3, 'CODE', $4, $5, $6, $7)
       ON CONFLICT (entry_id) DO NOTHING`,
      [`code:${s.id}`, `${s.name} (${s.kind})`, type, s.project_id, pos.x, pos.y, pos.z]
    );
  }
  console.log(`Inserted ${missing.length} graph nodes with positions.`);

  // Step 3: Fix nodes at (0,0,0) — assign positions
  const { rows: zeroed } = await pool.query(
    `SELECT entry_id, type FROM graph_nodes WHERE x = 0 AND y = 0 AND z = 0 ORDER BY entry_id`
  );
  if (zeroed.length > 0) {
    console.log(`Fixing ${zeroed.length} nodes at (0,0,0)...`);
    for (let i = 0; i < zeroed.length; i++) {
      const pos = fibonacciSphere(i, zeroed.length);
      await pool.query(
        `UPDATE graph_nodes SET x = $1, y = $2, z = $3 WHERE entry_id = $4`,
        [pos.x, pos.y, pos.z, zeroed[i].entry_id]
      );
    }
    console.log(`Fixed ${zeroed.length} node positions.`);
  }

  await pool.end();
}
main();
