const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', user:'sa4e_user', password:'sa4e_local_dev_password', database:'sa4e_db' });
async function run() {
  const client = await pool.connect();
  try {
    const configPid = '22b039993db3';
    const extPid = 'SDLC-Agents-4-Enterprise';
    
    const r1 = await client.query('UPDATE files SET project_id = $1 WHERE project_id = $2', [configPid, extPid]);
    console.log('files: updated ' + r1.rowCount + ' rows');
    
    const r2 = await client.query('UPDATE symbols SET project_id = $1 WHERE project_id = $2', [configPid, extPid]);
    console.log('symbols: updated ' + r2.rowCount + ' rows');
    
    const r3 = await client.query('UPDATE graph_nodes SET project_id = $1 WHERE project_id = $2', [configPid, extPid]);
    console.log('graph_nodes: updated ' + r3.rowCount + ' rows');
    
    console.log('\nDone! Refresh dashboard.');
  } finally { client.release(); await pool.end(); }
}
run().catch(e => console.error(e.message));
