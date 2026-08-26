/**
 * SA4E-215 — Migration Script (ALIGNED TO REAL sa4e_db, verified 2026-08-26).
 *
 *  - Connects to the ACTIVE database (PostgreSQL per DatabaseConfigService).
 *  - Idempotently CREATE TABLE IF NOT EXISTS for the two tables SA4E-215 owns:
 *      mcp_servers, decisions
 *  - Upserts MCP server declarations from orchestration.json (if present).
 *
 * Conventions (DO NOT deviate — matches running platform):
 *   - TEXT primary keys (server_id, decision_id, project_id)
 *   - JSON stored as TEXT
 *   - booleans as INTEGER 0/1 (disabled)
 *
 * Usage: node scripts/migrate-mcp.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- Resolve connection -------------------------------------------------------
function resolveConnection() {
  if (process.env.SA4E_DB_URL) {
    return { url: process.env.SA4E_DB_URL };
  }
  // Fall back to reading platform database.json (postgresql section, decrypted).
  const dataDir = process.env.CODE_INTEL_DATA_DIR
    || path.join(process.cwd(), '.code-intel');
  const dbJson = path.join(dataDir, 'database.json');
  if (fs.existsSync(dbJson)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(dbJson, 'utf8'));
      if (cfg.activeEngine === 'postgresql' && cfg.engines && cfg.engines.postgresql) {
        const pg = cfg.engines.postgresql;
        const password = pg.password && pg.password.startsWith('ENC:')
          ? decrypt(pg.password, path.join(dataDir, '.dbkey'))
          : (pg.password || '');
        return {
          url: `postgresql://${encodeURIComponent(pg.username)}:${encodeURIComponent(password)}@${pg.host}:${pg.port}/${pg.database}`,
        };
      }
    } catch (e) {
      console.warn('[migrate] could not read database.json:', e.message);
    }
  }
  // Verified dev database (SA4E-215 local environment).
  return { url: 'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db' };
}

function decrypt(ciphertext, keyPath) {
  const key = fs.readFileSync(keyPath);
  const data = Buffer.from(ciphertext.slice(4), 'base64');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(data.length - 16);
  const enc = data.subarray(12, data.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final('utf8');
}

// --- DDL ---------------------------------------------------------------------
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS mcp_servers (
  server_id      TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL,
  name           TEXT NOT NULL,
  transport_type TEXT NOT NULL,
  url            TEXT,
  command        TEXT,
  args           TEXT,
  env            TEXT,
  disabled       INTEGER NOT NULL DEFAULT 0,
  auto_approve   TEXT,
  tools          TEXT,
  created_at     TIMESTAMP NOT NULL,
  updated_at     TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_project_id   ON mcp_servers(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_servers_name_project ON mcp_servers(name, project_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_disabled     ON mcp_servers(disabled);

CREATE TABLE IF NOT EXISTS decisions (
  decision_id  TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  project_id   TEXT,
  rule_set_id  TEXT NOT NULL,
  input_params TEXT,
  result       TEXT NOT NULL,
  confidence   REAL NOT NULL DEFAULT 0,
  evaluated_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decisions_user_id        ON decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_decisions_evaluated_at   ON decisions(evaluated_at);
CREATE INDEX IF NOT EXISTS idx_decisions_rule_set_id    ON decisions(rule_set_id);
`;

// --- Migration ---------------------------------------------------------------
async function migrate() {
  const { Client } = require('pg');
  const conn = resolveConnection();
  console.log('=== SA4E-215 MCP Server Migration ===');
  console.log(`Connecting to: ${conn.url.replace(/\/\/[^@]+@/, '//***@')}`);

  const client = new Client({ connectionString: conn.url });
  try {
    await client.connect();
    console.log('✓ Database connected');
  } catch (err) {
    console.error('✗ Failed to connect to database:', err.message);
    process.exit(1);
  }

  // 1) Create tables
  try {
    await client.query(CREATE_SQL);
    console.log('✓ Tables mcp_servers, decisions ensured (CREATE IF NOT EXISTS)');
  } catch (err) {
    console.error('✗ Schema creation failed:', err.message);
    await client.end();
    process.exit(1);
  }

  // 2) Locate orchestration.json
  const candidates = [
    process.env.CODE_INTEL_ORCHESTRATION || 'orchestration.json',
    path.join(process.cwd(), 'orchestration.json'),
    path.join(process.cwd(), 'backend', 'orchestration.json'),
  ];
  let orchestrationPath = candidates.find((p) => fs.existsSync(p));
  if (!orchestrationPath) {
    console.log('⚠ orchestration.json not found — skipping data upsert (tables only).');
    await client.end();
    console.log('=== Migration Complete (schema only) ===');
    return;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(orchestrationPath, 'utf8'));
    console.log(`✓ Read ${orchestrationPath}`);
  } catch (err) {
    console.error('✗ Failed to parse orchestration.json:', err.message);
    await client.end();
    process.exit(1);
  }

  const servers = Array.isArray(data.mcpServers) ? data.mcpServers : [];
  console.log(`Found ${servers.length} MCP servers in orchestration.json`);

  const results = { added: 0, updated: 0, skipped: 0, errors: 0 };

  for (const s of servers) {
    try {
      if (!s || !s.name || !s.transport_type) {
        console.warn(`⚠ Skipping invalid entry: ${JSON.stringify(s)}`);
        results.skipped++;
        continue;
      }
      const projectId = String(s.project_id != null ? s.project_id : 'default');
      const now = new Date().toISOString();

      // Ensure the project exists in project_registry (TEXT PK, no FK constraint).
      await client.query(
        `INSERT INTO project_registry (project_id, display_name, workspace_path, last_seen, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id) DO NOTHING`,
        [projectId, projectId, '', now, 'migrate-sa4e-215'],
      );

      const serverId = 'mcp-' + crypto.randomBytes(6).toString('hex');
      const res = await client.query(
        `INSERT INTO mcp_servers
           (server_id, project_id, name, transport_type, url, command, args, env, disabled, auto_approve, tools, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (name, project_id) DO UPDATE SET
           transport_type = EXCLUDED.transport_type,
           url            = EXCLUDED.url,
           command        = EXCLUDED.command,
           args           = EXCLUDED.args,
           env            = EXCLUDED.env,
           disabled       = EXCLUDED.disabled,
           auto_approve   = EXCLUDED.auto_approve,
           tools          = EXCLUDED.tools,
           updated_at     = EXCLUDED.updated_at
         RETURNING (xmax = 0) AS inserted`,
        [
          serverId, projectId, s.name, s.transport_type,
          s.url || null, s.command || null,
          s.args ? JSON.stringify(s.args) : null,
          s.env ? JSON.stringify(s.env) : null,
          s.disabled ? 1 : 0,
          s.auto_approve ? JSON.stringify(s.auto_approve) : null,
          s.tools ? JSON.stringify(s.tools) : null,
          now, now,
        ],
      );
      if (res.rows[0] && res.rows[0].inserted) results.added++;
      else results.updated++;
    } catch (err) {
      results.errors++;
      console.error(`✗ Error migrating server "${s && s.name}":`, err.message);
    }
  }

  const { rows } = await client.query('SELECT COUNT(*)::int AS cnt FROM mcp_servers');
  console.log('\n=== Migration Results ===');
  console.log(`Added:   ${results.added}`);
  console.log(`Updated: ${results.updated}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Errors:  ${results.errors}`);
  console.log(`DB total mcp_servers: ${rows[0].cnt}`);
  console.log('========================');

  await client.end();
  console.log('=== Migration Complete ===');
}

migrate().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
