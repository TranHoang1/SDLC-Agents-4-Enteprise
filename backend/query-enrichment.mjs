import { DatabaseConfigService } from './src/database/config/DatabaseConfigService.js';
import pg from 'pg';
const { Client } = pg;

const cfgService = new DatabaseConfigService('.code-intel');
const active = cfgService.getActiveConfig();
console.log('Engine:', active.engine, 'Host:', active.host, 'DB:', active.database);

const client = new Client({
  host: active.host, port: active.port,
  user: active.username, password: active.password,
  database: active.database, ssl: active.ssl ? { rejectUnauthorized: false } : false,
});

await client.connect();

// Query: type breakdown for done entries with empty structured_map
const r1 = await client.query(`
  SELECT type, COUNT(*) as cnt 
  FROM knowledge_entries 
  WHERE enrichment_status = 'done' AND (structured_map = '{}' OR structured_map IS NULL)
  AND project_id = '3e268111b055'
  GROUP BY type ORDER BY cnt DESC
`);
console.log('\n=== DONE + EMPTY structured_map by TYPE ===');
console.table(r1.rows);

// Also check: done entries WITH structured_map data
const r2 = await client.query(`
  SELECT type, COUNT(*) as cnt 
  FROM knowledge_entries 
  WHERE enrichment_status = 'done' AND structured_map != '{}' AND structured_map IS NOT NULL
  AND project_id = '3e268111b055'
  GROUP BY type ORDER BY cnt DESC
`);
console.log('\n=== DONE + HAS structured_map by TYPE ===');
console.table(r2.rows);

// Check a sample done entry with data
const r3 = await client.query(`
  SELECT id, type, LEFT(structured_map, 200) as map_preview
  FROM knowledge_entries 
  WHERE enrichment_status = 'done' AND structured_map != '{}' AND structured_map IS NOT NULL
  AND project_id = '3e268111b055'
  LIMIT 2
`);
console.log('\n=== SAMPLE DONE WITH DATA ===');
console.table(r3.rows);

await client.end();
