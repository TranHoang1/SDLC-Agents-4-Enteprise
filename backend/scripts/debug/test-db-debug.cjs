const Database = require('better-sqlite3');
const path = require('path');

// Usage: node test-db-debug.js [db-path]
// Defaults to .code-intel/index-backend.db relative to repo root.
const repoRoot = path.resolve(__dirname, '..', '..');
const dbPath = path.resolve(process.argv[2] || path.join(repoRoot, '.code-intel', 'index-backend.db'));

console.log('DB Path:', dbPath);
const db = new Database(dbPath, { readonly: true });

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
