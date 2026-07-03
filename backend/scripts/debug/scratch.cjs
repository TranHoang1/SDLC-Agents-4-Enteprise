const Database = require('better-sqlite3');
const db = new Database('./.code-intel/index.db', { readonly: true });
try {
  const duplicates = db.prepare(`
    SELECT source, COUNT(*) as count 
    FROM knowledge_entries 
    WHERE source IS NOT NULL 
    GROUP BY source 
    HAVING count > 10
    LIMIT 20
  `).all();
  console.log('Duplicates:');
  console.log(duplicates);
} catch (err) {
  console.error(err.message);
}
db.close();
