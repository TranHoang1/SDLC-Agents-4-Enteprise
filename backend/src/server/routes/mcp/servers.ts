/**
 * SA4E-215 — MCP Server declaration/config routes (aligned to real sa4e_db).
 *
 * CRUD on the NEW `mcp_servers` table. Distinct from mcp_tools (server tool
 * ingest/search). Scoped by project_registry.project_id (TEXT FK, no constraint
 * enforced via adapter but validated against project_registry).
 * Uses getDbAdapter() + recordAudit.
 * Mounted at /api/sa4e-215/mcp/servers (via sa4e-215/index.ts).
 */
import { Hono } from 'hono';
import * as crypto from 'crypto';
import pino from 'pino';
import { getDbAdapter, recordAudit } from '../../../admin/admin-db.js';
import { requireSa4eUser } from '../sa4e-215/guard.js';

const logger = pino({ name: 'sa4e-215-mcp-servers' });

function rowToServer(r: Record<string, unknown>) {
  return {
    serverId: r.server_id,
    projectId: r.project_id,
    name: r.name,
    transportType: r.transport_type,
    url: r.url,
    command: r.command,
    args: r.args ? JSON.parse(r.args as string) : [],
    env: r.env ? JSON.parse(r.env as string) : {},
    disabled: !!(r.disabled as number),
    autoApprove: r.auto_approve ? JSON.parse(r.auto_approve as string) : [],
    tools: r.tools ? JSON.parse(r.tools as string) : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createSa4e215McpServersRoutes(): Hono {
  const app = new Hono();

  // GET /api/sa4e-215/mcp/servers?projectId=&disabled=
  app.get('/', async (c) => {
    const auth = await requireSa4eUser(c);
    if (auth instanceof Response) return auth;

    try {
      const adapter = getDbAdapter();
      const projectId = c.req.query('projectId');
      const disabled = c.req.query('disabled');

      let sql = 'SELECT * FROM mcp_servers WHERE 1=1';
      const params: unknown[] = [];
      if (projectId) { sql += ' AND project_id = ?'; params.push(projectId); }
      if (disabled !== undefined) {
        sql += ' AND disabled = ?';
        params.push(disabled === 'true' || disabled === '1' ? 1 : 0);
      }
      sql += ' ORDER BY created_at DESC';

      const rows = await adapter.allAsync<Record<string, unknown>>(sql, params);
      return c.json({ success: true, data: rows.map(rowToServer) });
    } catch (err: any) {
      logger.error({ err }, 'list mcp servers error');
      return c.json({ success: false, error: { code: 'ERR_009', message: 'Failed to list MCP servers' } }, 500);
    }
  });

  // POST /api/sa4e-215/mcp/servers
  app.post('/', async (c) => {
    const auth = await requireSa4eUser(c);
    if (auth instanceof Response) return auth;

    try {
      const body = await c.req.json();
      const {
        projectId, name, transportType, url, command, args, env, disabled, autoApprove, tools,
      } = body;

      if (!projectId || !name || !transportType) {
        return c.json(
          { success: false, error: { code: 'ERR_001', message: 'projectId, name and transportType are required' } },
          400,
        );
      }

      const adapter = getDbAdapter();

      const project = await adapter.getAsync<{ project_id: string }>(
        'SELECT project_id FROM project_registry WHERE project_id = ?', [projectId],
      );
      if (!project) {
        return c.json(
          { success: false, error: { code: 'ERR_006', message: 'Unknown project_id' } },
          400,
        );
      }

      const existing = await adapter.getAsync<{ server_id: string }>(
        'SELECT server_id FROM mcp_servers WHERE name = ? AND project_id = ?', [name, projectId],
      );
      if (existing) {
        return c.json(
          { success: false, error: { code: 'ERR_001', message: 'Server name already exists for this project' } },
          400,
        );
      }

      const serverId = 'mcp-' + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();

      await adapter.runAsync(
        `INSERT INTO mcp_servers
          (server_id, project_id, name, transport_type, url, command, args, env, disabled, auto_approve, tools, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          serverId,
          projectId,
          name,
          transportType,
          url || null,
          command || null,
          args ? JSON.stringify(args) : null,
          env ? JSON.stringify(env) : null,
          disabled ? 1 : 0,
          autoApprove ? JSON.stringify(autoApprove) : null,
          tools ? JSON.stringify(tools) : null,
          now,
          now,
        ],
      );

      await recordAudit(
        auth.userId,
        auth.username,
        'MCP_SERVER_CREATE',
        'mcp_server',
        serverId,
        JSON.stringify({ projectId, name, transportType }),
      );

      const r = await adapter.getAsync<Record<string, unknown>>(
        'SELECT * FROM mcp_servers WHERE server_id = ?', [serverId],
      );
      return c.json({ success: true, data: rowToServer(r!) });
    } catch (err: any) {
      logger.error({ err }, 'create mcp server error');
      return c.json({ success: false, error: { code: 'ERR_009', message: 'Failed to create MCP server' } }, 500);
    }
  });

  // GET /api/sa4e-215/mcp/servers/:id
  app.get('/:id', async (c) => {
    const auth = await requireSa4eUser(c);
    if (auth instanceof Response) return auth;

    try {
      const id = c.req.param('id');
      const adapter = getDbAdapter();
      const r = await adapter.getAsync<Record<string, unknown>>(
        'SELECT * FROM mcp_servers WHERE server_id = ?', [id],
      );
      if (!r) {
        return c.json({ success: false, error: { code: 'ERR_006', message: 'MCP server not found' } }, 404);
      }
      return c.json({ success: true, data: rowToServer(r) });
    } catch (err: any) {
      logger.error({ err }, 'get mcp server error');
      return c.json({ success: false, error: { code: 'ERR_009', message: 'Failed to get MCP server' } }, 500);
    }
  });

  // PUT /api/sa4e-215/mcp/servers/:id
  app.put('/:id', async (c) => {
    const auth = await requireSa4eUser(c);
    if (auth instanceof Response) return auth;

    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      const adapter = getDbAdapter();

      const existing = await adapter.getAsync<Record<string, unknown>>(
        'SELECT * FROM mcp_servers WHERE server_id = ?', [id],
      );
      if (!existing) {
        return c.json({ success: false, error: { code: 'ERR_006', message: 'MCP server not found' } }, 404);
      }

      const fields: string[] = [];
      const params: unknown[] = [];
      const set = (col: string, val: unknown) => { fields.push(`${col} = ?`); params.push(val); };

      if (body.name !== undefined) set('name', body.name);
      if (body.transportType !== undefined) set('transport_type', body.transportType);
      if (body.url !== undefined) set('url', body.url);
      if (body.command !== undefined) set('command', body.command);
      if (body.args !== undefined) set('args', JSON.stringify(body.args));
      if (body.env !== undefined) set('env', JSON.stringify(body.env));
      if (body.disabled !== undefined) set('disabled', body.disabled ? 1 : 0);
      if (body.autoApprove !== undefined) set('auto_approve', JSON.stringify(body.autoApprove));
      if (body.tools !== undefined) set('tools', JSON.stringify(body.tools));

      set('updated_at', new Date().toISOString());
      params.push(id);

      await adapter.runAsync(
        `UPDATE mcp_servers SET ${fields.join(', ')} WHERE server_id = ?`, params,
      );
      await recordAudit(auth.userId, auth.username, 'MCP_SERVER_UPDATE', 'mcp_server', id);

      const r = await adapter.getAsync<Record<string, unknown>>(
        'SELECT * FROM mcp_servers WHERE server_id = ?', [id],
      );
      return c.json({ success: true, data: rowToServer(r!) });
    } catch (err: any) {
      logger.error({ err }, 'update mcp server error');
      return c.json({ success: false, error: { code: 'ERR_009', message: 'Failed to update MCP server' } }, 500);
    }
  });

  // DELETE /api/sa4e-215/mcp/servers/:id
  app.delete('/:id', async (c) => {
    const auth = await requireSa4eUser(c);
    if (auth instanceof Response) return auth;

    try {
      const id = c.req.param('id');
      const adapter = getDbAdapter();
      const existing = await adapter.getAsync<{ server_id: string }>(
        'SELECT server_id FROM mcp_servers WHERE server_id = ?', [id],
      );
      if (!existing) {
        return c.json({ success: false, error: { code: 'ERR_006', message: 'MCP server not found' } }, 404);
      }
      await adapter.runAsync('DELETE FROM mcp_servers WHERE server_id = ?', [id]);
      await recordAudit(auth.userId, auth.username, 'MCP_SERVER_DELETE', 'mcp_server', id);
      return c.json({ success: true, message: 'MCP server deleted' });
    } catch (err: any) {
      logger.error({ err }, 'delete mcp server error');
      return c.json({ success: false, error: { code: 'ERR_009', message: 'Failed to delete MCP server' } }, 500);
    }
  });

  return app;
}
