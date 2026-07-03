const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
try {
  const indexDbPath = path.resolve('C:/projects/kiro/FEC_CR_Builder/.code-intel/index-backend.db');
  console.log("DB Path:", indexDbPath);
  const indexDb = new Database(indexDbPath, { readonly: true });
  const rows = indexDb.prepare('SELECT tags FROM knowledge_entries WHERE tags IS NOT NULL AND tags != "" LIMIT 10').all();
  console.log('Rows:', rows);
} catch(e) {
  console.error('ERROR', e);
}
