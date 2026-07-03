import Database from 'better-sqlite3';
import * as path from 'path';

const DOCUMENT_TYPES = {
    "BRD": "REQUIREMENT",
    "FSD": "REQUIREMENT",
    "TDD": "ARCHITECTURE",
    "STP": "PROCEDURE",
    "STC": "PROCEDURE",
    "DPG": "PROCEDURE",
    "RLN": "PROCEDURE",
    "UG": "PROCEDURE",
    "TEST-REPORT": "PROCEDURE",
    "DISCREPANCY": "CONTEXT",
    "SECURITY-REPORT": "PROCEDURE"
};

function tierForType(type) {
  switch (type) { 
    case 'REQUIREMENT': 
    case 'ARCHITECTURE': 
    case 'PROCEDURE': 
    case 'API_DESIGN': 
      return 'SEMANTIC'; 
    case 'DECISION': 
    case 'LESSON_LEARNED': 
    case 'ERROR_PATTERN': 
      return 'EPISODIC'; 
    default: 
      return 'WORKING'; 
  }
}

const dbPath = path.join(__dirname, '..', '.code-intel', 'index.db');
const db = new Database(dbPath);

try {
  // 1. De-duplicate entries
  console.log('Running de-duplication...');
  const initialCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_entries').get().count;
  
  db.prepare(`
    DELETE FROM knowledge_entries
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM knowledge_entries
      GROUP BY COALESCE(source, ''), content
    )
  `).run();
  
  const midCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_entries').get().count;
  console.log(`De-duplicated: ${initialCount} -> ${midCount} entries (removed ${initialCount - midCount} duplicates)`);

  // 2. Classify and update type & tier
  console.log('Classifying and updating types...');
  const rows = db.prepare('SELECT id, source FROM knowledge_entries WHERE source IS NOT NULL').all();
  
  let updatedCount = 0;
  
  const updateStmt = db.prepare('UPDATE knowledge_entries SET type = ?, tier = ? WHERE id = ?');
  const updateMany = db.transaction((entries) => {
    for (const entry of entries) {
      const source = entry.source;
      const ext = path.extname(source).toLowerCase();
      const baseName = path.basename(source, ext).toUpperCase();
      let docType = "CONTEXT";
      for (const key of Object.keys(DOCUMENT_TYPES)) {
        if (baseName === key || baseName.startsWith(key + "-") || baseName.startsWith(key + "_") || baseName.startsWith(key)) {
          docType = DOCUMENT_TYPES[key];
          break;
        }
      }
      
      const tier = tierForType(docType);
      updateStmt.run(docType, tier, entry.id);
      updatedCount++;
    }
  });

  updateMany(rows);
  console.log(`Updated ${updatedCount} entries with correct type and tier.`);

  const finalDistribution = db.prepare('SELECT type, COUNT(*) as count FROM knowledge_entries GROUP BY type').all();
  console.log('Final type distribution:');
  console.log(finalDistribution);
  
} catch (err) {
  console.error('Migration failed:', err);
} finally {
  db.close();
}
