const path = require("path");
const { DatabaseConfigService } = require("./dist/database/config/DatabaseConfigService.js");
const svc = new DatabaseConfigService(path.resolve(".code-intel"));
const config = svc.load();
const pg = config.engines.postgresql;
console.log("Host:", pg.host, "Port:", pg.port, "DB:", pg.database, "User:", pg.username);
console.log("Pass (decrypted):", pg.password ? pg.password.substring(0,3) + "..." : "null");

const { Client } = require("pg");
async function main() {
  const client = new Client({ host: pg.host, port: pg.port, user: pg.username, password: pg.password, database: pg.database });
  await client.connect();
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log(`\n=== ${pg.database} (${tables.rows.length} tables) ===`);
  for (const row of tables.rows) {
    const count = await client.query(`SELECT COUNT(*) as c FROM public."${row.tablename}"`);
    console.log(`  ${row.tablename}: ${count.rows[0].c}`);
  }
  await client.end();
}
main().catch(e => console.error("DB Error:", e.message));
