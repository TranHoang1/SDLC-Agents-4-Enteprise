/**
 * SA4E-215 — Authentication routes (aligned to real sa4e_db).
 *
 * Uses platform primitives (NOT Prisma/argon2):
 *  - getDbAdapter()        : unified async DatabaseAdapter (SQLite/PostgreSQL)
 *  - hashPassword/verifyPassword : PBKDF2 salt:hash (sha512)
 *  - createSession/validateSession/invalidateSession : session tokens
 *  - recordAudit           : writes to real audit_log table
 *  - getUserPermissions    : group-based RBAC
 *
 * Mounted at /api/sa4e-215/auth (via sa4e-215/index.ts).
 */
import { Hono } from 'hono';
import * as crypto from 'crypto';
import pino from 'pino';
import {
  getDbAdapter,
  hashPassword,
  verifyPassword,
  createSession,
  invalidateSession,
  validateSession,
  recordAudit,
  getUserPermissions,
} from '../../../admin/admin-db.js';

const logger = pino({ name: 'sa4e-215-auth' });

export function createSa4e215AuthRoutes(): Hono {
  const app = new Hono();

  // POST /api/sa4e-215/auth/register
  app.post('/register', async (c) => {
    try {
      const { email, password, access_group_id } = await c.req.json();
      if (!email || !password) {
        return c.json(
          { success: false, error: { code: 'ERR_001', message: 'Email and password are required' } },
          400,
        );
      }
      const groupId = access_group_id || 'grp-dev';
      const adapter = getDbAdapter();

      const existing = await adapter.getAsync<{ user_id: string }>(
        'SELECT user_id FROM users WHERE email = ?',
        [email],
      );
      if (existing) {
        return c.json(
          { success: false, error: { code: 'ERR_001', message: 'Email already registered' } },
          400,
        );
      }

      const userId = 'user-' + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();
      await adapter.runAsync(
        `INSERT INTO users (user_id, username, email, password_hash, status, access_group_id, force_password_change, created_at)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, 0, ?)`,
        [userId, email, email, hashPassword(password), groupId, now],
      );
      await recordAudit(userId, email, 'REGISTER', 'user', userId);

      return c.json({ success: true, data: { userId, email, accessGroupId: groupId } });
    } catch (err: any) {
      logger.error({ err }, 'register error');
      return c.json({ success: false, error: { code: 'ERR_001', message: 'Registration failed' } }, 500);
    }
  });

  // POST /api/sa4e-215/auth/login
  app.post('/login', async (c) => {
    try {
      const { email, password } = await c.req.json();
      if (!email || !password) {
        return c.json(
          { success: false, error: { code: 'ERR_001', message: 'Email and password are required' } },
          400,
        );
      }
      const adapter = getDbAdapter();
      const row = await adapter.getAsync<Record<string, unknown>>(
        'SELECT * FROM users WHERE email = ?',
        [email],
      );
      if (!row) {
        await recordAudit('unknown', email, 'LOGIN_FAILED', 'auth');
        return c.json({ success: false, error: { code: 'ERR_002', message: 'Invalid email or password' } }, 401);
      }
      if (row.status !== 'ACTIVE') {
        return c.json({ success: false, error: { code: 'ERR_002', message: 'Account disabled' } }, 403);
      }
      if (!verifyPassword(password, row.password_hash as string)) {
        await recordAudit(row.user_id as string, row.username as string, 'LOGIN_FAILED', 'auth');
        return c.json({ success: false, error: { code: 'ERR_002', message: 'Invalid email or password' } }, 401);
      }

      const session = await createSession(row.user_id as string);
      await adapter.runAsync('UPDATE users SET last_login = ? WHERE user_id = ?', [
        new Date().toISOString(),
        row.user_id as string,
      ]);
      await recordAudit(row.user_id as string, row.username as string, 'LOGIN', 'auth', session.sessionId);

      const perms = await getUserPermissions(row.user_id as string);
      return c.json({
        success: true,
        data: {
          token: session.token,
          user: {
            userId: row.user_id,
            email: row.email,
            accessGroupId: row.access_group_id,
            permissions: perms.map((p: any) => p.permissionId),
          },
          expiresAt: session.expiresAt,
        },
      });
    } catch (err: any) {
      logger.error({ err }, 'login error');
      return c.json({ success: false, error: { code: 'ERR_002', message: 'Login failed' } }, 500);
    }
  });

  // POST /api/sa4e-215/auth/logout
  app.post('/logout', async (c) => {
    const auth = c.req.header('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token) {
      const user = await validateSession(token);
      if (user) await recordAudit(user.userId, user.username, 'LOGOUT', 'auth');
      await invalidateSession(token);
    }
    return c.json({ success: true, message: 'Successfully logged out' });
  });

  return app;
}
