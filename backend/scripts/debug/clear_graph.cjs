const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', '.code-intel', 'admin.db');
const db = new Database(dbPath);
try {
  db.prepare('DELETE FROM graph_nodes').run();
  db.prepare('DELETE FROM graph_edges').run();
  console.log('Cleared ghost nodes from admin.db at', dbPath);
} catch (err) {
  console.error(err.message);
}
db.close();
