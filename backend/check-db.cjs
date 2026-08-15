const Database = require("better-sqlite3");
const path = require("path");
const base = "c:/projects/kiro/SDLC-Agents-4-Enterprise/backend/.code-intel";
for (const dbFile of ["admin.db", "index.db", "knowledge.db"]) {
  try {
    const db = new Database(path.join(base, dbFile), { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    console.log("\n=== " + dbFile + " (" + tables.length + " tables) ===");
    for (const t of tables) {
      const count = db.prepare("SELECT COUNT(*) as c FROM \"" + t.name + "\"").get();
      console.log("  " + t.name + ": " + count.c);
    }
    db.close();
  } catch(e) { console.log(dbFile + ": " + e.message); }
}
