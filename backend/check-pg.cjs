const { Client } = require("pg");
async function main() {
  const client = new Client({ host: "localhost", port: 5432, user: "sa4e_user", password: "sa4e_pass", database: "sa4e_db" });
  await client.connect();
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log(`\n=== sa4e_db (${tables.rows.length} tables) ===\n`);
  for (const row of tables.rows) {
    const count = await client.query(`SELECT COUNT(*) as c FROM public."${row.tablename}"`);
    const n = parseInt(count.rows[0].c);
    if (n > 0) console.log(`  ${row.tablename}: ${n}`);
    else console.log(`  ${row.tablename}: 0`);
  }
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
