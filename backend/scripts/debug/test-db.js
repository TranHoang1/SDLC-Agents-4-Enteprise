import Database from 'better-sqlite3';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');
const dbPath = path.join(repoRoot, '.code-intel', 'index.db');

console.log('Querying index.db at:', dbPath);
const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

for (const table of tables) {
  try {
    const count = db.prepare(`SELECT count(*) as count FROM ${table.name}`).get();
    console.log(`Table ${table.name}: ${count.count} rows`);
  } catch (err) {
    console.error(`Error querying ${table.name}:`, err.message);
  }
}

db.close();
