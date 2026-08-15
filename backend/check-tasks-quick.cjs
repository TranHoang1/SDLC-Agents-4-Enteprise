const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost', port: 5432,
  user: 'sa4e_user', password: 'sa4e_dev_2024',
  database: 'sa4e_db'
});
async function main() {
  try {
    const r = await pool.query('SELECT status, COUNT(*) as cnt FROM pending_tasks GROUP BY status ORDER BY cnt DESC');
    console.log('PENDING TASKS:', JSON.stringify(r.rows));
    const r2 = await pool.query("SELECT task_type, status, COUNT(*) as cnt FROM pending_tasks GROUP BY task_type, status ORDER BY cnt DESC LIMIT 10");
    console.log('BY TYPE:', JSON.stringify(r2.rows));
  } catch(e) { console.error(e.message); }
  await pool.end();
}
main();
