import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db' });

try {
  // Check: how many FUNCTION nodes have null summary (unenriched)?
  const unenriched = await pool.query(`
    SELECT COUNT(*) as cnt FROM graph_nodes gn
    JOIN symbols s ON s.id = CAST(REPLACE(gn.entry_id, 'code:', '') AS INTEGER)
    WHERE gn.type = 'FUNCTION' AND gn.entry_id LIKE 'code:%'
    AND (s.summary IS NULL OR s.summary = '')
  `);
  console.log('=== FUNCTION nodes with NULL summary ===');
  console.log(unenriched.rows);

  // Check: how many FUNCTION nodes have signature?
  const noSig = await pool.query(`
    SELECT COUNT(*) as cnt FROM graph_nodes gn
    JOIN symbols s ON s.id = CAST(REPLACE(gn.entry_id, 'code:', '') AS INTEGER)
    WHERE gn.type = 'FUNCTION' AND gn.entry_id LIKE 'code:%'
    AND (s.signature IS NULL OR s.signature = '')
  `);
  console.log('\n=== FUNCTION nodes with NULL signature ===');
  console.log(noSig.rows);

  // Check project_id filter issue: what projects exist?
  const projects = await pool.query(`
    SELECT DISTINCT project_id, COUNT(*) as cnt 
    FROM graph_nodes WHERE entry_id LIKE 'code:%' 
    GROUP BY project_id ORDER BY cnt DESC LIMIT 5
  `);
  console.log('\n=== Projects in graph_nodes (code nodes) ===');
  console.log(projects.rows);

  // Check: the SymbolRepository uses indexAdapter (same DB or different?)
  // Verify symbols table is accessible from same connection
  const symCount = await pool.query('SELECT COUNT(*) as cnt FROM symbols');
  const graphCount = await pool.query('SELECT COUNT(*) as cnt FROM graph_nodes');
  console.log('\n=== Table counts in SAME database ===');
  console.log('symbols:', symCount.rows[0].cnt);
  console.log('graph_nodes:', graphCount.rows[0].cnt);

  // Specifically for isAbsoluteHttpUrl - what project_id?
  const proj = await pool.query(`
    SELECT s.project_id, gn.project_id as gn_project_id
    FROM symbols s
    JOIN graph_nodes gn ON gn.entry_id = 'code:' || CAST(s.id AS TEXT)
    WHERE s.name = 'isAbsoluteHttpUrl'
  `);
  console.log('\n=== isAbsoluteHttpUrl project_id (symbols vs graph_nodes) ===');
  console.log(proj.rows);

  // Try to exactly simulate what happens when API is called
  // The route uses ctx.db.symbol.getSymbolDetail(symbolId)
  // which queries: SELECT ... FROM symbols s JOIN files f ON s.file_id = f.id WHERE s.id = ?
  // WITHOUT project_id filter!
  const directQuery = await pool.query(`
    SELECT s.id, s.name, s.kind, s.signature, s.start_line, s.end_line,
           s.parent_symbol, s.visibility, s.doc_comment,
           s.summary, s.pseudo_code, s.llm_tags, s.enrichment_status,
           f.relative_path, f.language, f.module
    FROM symbols s JOIN files f ON s.file_id = f.id
    WHERE s.id = 30252
  `);
  console.log('\n=== Direct query (no project filter) for id=30252 ===');
  console.log(directQuery.rows.length > 0 ? 'FOUND' : 'NOT FOUND');
  if (directQuery.rows.length > 0) {
    const r = directQuery.rows[0];
    console.log(`  name=${r.name}, kind=${r.kind}, file=${r.relative_path}`);
    console.log(`  summary=${r.summary ? r.summary.substring(0,50) + '...' : 'NULL'}`);
  }

} catch (e) {
  console.error('Error:', e.message, e.stack);
} finally {
  await pool.end();
}
