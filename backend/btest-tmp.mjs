import Database from 'better-sqlite3';
const db = new Database(':memory:');
db.exec('CREATE TABLE t (project_id TEXT)');
db.prepare('INSERT INTO t VALUES (?)').run('p1');
const s = db.prepare('SELECT COUNT(*) cnt FROM t WHERE project_id = $1');
console.log('named scalar bind:', JSON.stringify(s.get('p1')));
try {
  console.log('array bind:', JSON.stringify(s.get(['p1'])));
} catch (e) {
  console.log('array bind ERROR:', e.message);
}
try {
  console.log('raw get() bind:', JSON.stringify(s.get()));
} catch (e) {
  console.log('no-param bind ERROR:', e.message);
}