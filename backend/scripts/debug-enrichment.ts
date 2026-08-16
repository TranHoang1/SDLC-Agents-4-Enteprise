import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db' });

const statusRows = await pool.query('SELECT enrichment_status, COUNT(*) as cnt FROM symbols GROUP BY enrichment_status');
console.log('Enrichment status distribution:');
console.table(statusRows.rows);

const kindRows = await pool.query(`
  SELECT kind, COUNT(*) as cnt FROM symbols 
  WHERE enrichment_status IS NULL OR enrichment_status = 'FAILED' 
     OR (enrichment_status = 'COMPLETED' AND summary IS NULL)
  GROUP BY kind ORDER BY cnt DESC LIMIT 20
`);
console.log('Unenriched symbols by kind (eligible for tasks):');
console.table(kindRows.rows);

const enrichableKinds = new Set(['class','interface','enum','function','method','arrow_function','generator']);
const eligible = kindRows.rows.filter(r => enrichableKinds.has(r.kind) || r.kind?.startsWith('pega_'));
const eligibleCount = eligible.reduce((sum, r) => sum + parseInt(r.cnt), 0);
console.log(`\nEligible for enrichment (ENRICHABLE_KINDS + pega_*): ${eligibleCount}`);
console.table(eligible);

await pool.end();
process.exit(0);
