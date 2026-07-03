// KSA-286: Standalone Admin Portal Server
// Run: npx tsx admin/standalone-server.ts
import express from 'express';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.ADMIN_PORT || '48722', 10);

// SQLite setup
const dbPath = path.join(__dirname, '../data/admin-test.db');
if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Migration + seed
db.exec(fs.readFileSync(path.join(__dirname, 'db/migrations/001-admin-portal.sql'), 'utf-8'));
db.exec(fs.readFileSync(path.join(__dirname, 'db/migrations/002-rbac-roles.sql'), 'utf-8'));
db.exec(fs.readFileSync(path.join(__dirname, 'db/seed/permissions.sql'), 'utf-8'));
console.log('[Admin] DB ready');

// JWT mock
const jwtService = { validate: (token: string) => token === 'admin-token' ? { sub: 'user-admin-001', username: 'admin' } : null };

// MCP Orchestrator — combine live status from backend + tool mapping from config
const mcpBackendUrl = 'http://127.0.0.1:9181/mcp';
let _mcpServersCache: any[] = [];

(async () => {
  // Load orchestration.json for tool-to-server mapping
  const orchPath = path.join(__dirname, '../../.code-intel/orchestration.json');
  let orchConfig: any = {};
  if (fs.existsSync(orchPath)) {
    orchConfig = JSON.parse(fs.readFileSync(orchPath, 'utf-8'));
  }

  try {
    // Get live server status from backend
    const statusBody = JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'orchestration_status',arguments:{}}});
    const statusResp = await fetch(mcpBackendUrl, {method:'POST', headers:{'Content-Type':'application/json'}, body: statusBody});
    const statusJson = await statusResp.json() as any;
    const statusContent = JSON.parse(statusJson?.result?.content?.[0]?.text || '{}');
    const liveServers = statusContent.servers || [];

    // Merge: live status + config tools
    _mcpServersCache = liveServers.map((s: any) => {
      const cfg = orchConfig.mcpServers?.[s.name] || {};
      const knownTools = cfg.tools || cfg.autoApprove || [];
      return {
        id: s.name, name: s.name,
        status: s.state === 'ACTIVE' ? 'RUNNING' : 'STOPPED',
        tools: knownTools.map((t: string) => ({ name: t, enabled: true })),
        toolCount: s.toolCount || knownTools.length,
        toolsDiscovered: knownTools.length > 0,
      };
    });

    // Add code-intelligence (self) — always running since we're querying it
    const selfCfg = orchConfig.mcpServers?.['code-intelligence'];
    if (selfCfg) {
      const selfTools = selfCfg.tools || [];
      _mcpServersCache.unshift({
        id: 'code-intelligence', name: 'code-intelligence',
        status: 'RUNNING',
        tools: selfTools.map((t: string) => ({ name: t, enabled: true })),
        toolCount: selfTools.length,
        toolsDiscovered: true,
      });
    }
    console.log(`[Admin] MCP: ${_mcpServersCache.length} servers loaded (live status + config tools)`);
  } catch (e) {
    console.log('[Admin] MCP backend unavailable, using config only');
    _mcpServersCache = Object.entries(orchConfig.mcpServers || {}).map(([id, cfg]: [string, any]) => ({
      id, name: id, status: cfg.disabled ? 'STOPPED' : 'RUNNING',
      tools: (cfg.tools || cfg.autoApprove || []).map((t: string) => ({ name: t, enabled: true })),
      toolsDiscovered: (cfg.tools || cfg.autoApprove || []).length > 0,
    }));
  }
})();

const mcpOrchestrator = {
  getServers: () => _mcpServersCache,
  restartServer: async () => {},
  toggleTool: () => {},
  getServerLogs: () => [],
};

const app = express();

// SPA FIRST (before admin API which has catch-all)
const spaFile = path.join(__dirname, '../viewer/admin/index.html');
console.log('[Admin] SPA:', spaFile, fs.existsSync(spaFile) ? 'OK' : 'MISSING');
app.get('/admin', (_req, res) => res.sendFile(spaFile));
app.get('/admin/', (_req, res) => res.sendFile(spaFile));

// Admin API module
import { registerAdminModule } from './index.js';
registerAdminModule(app, { db, jwtService, kbEngine: null, mcpOrchestrator });

app.listen(PORT, () => {
  console.log(`\n[Admin Portal] http://localhost:${PORT}/admin/`);
  console.log(`[Admin API]    http://localhost:${PORT}/api/admin/me`);
});
