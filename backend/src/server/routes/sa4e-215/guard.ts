/**
 * SA4E-215 — shared auth guard.
 * Uses the platform session mechanism (validateSession from admin-db).
 */
import type { Context } from 'hono';
import { validateSession } from '../../../admin/admin-db.js';

export interface Sa4eUser {
  userId: string;
  username: string;
  accessGroupId: string;
}

/** Extract and validate the Bearer session token. Returns user or null. */
export async function getSa4eUser(c: Context): Promise<Sa4eUser | null> {
  const auth = c.req.header('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  return (await validateSession(token)) as Sa4eUser | null;
}

/** Require an authenticated session; returns user or a 401 Response. */
export async function requireSa4eUser(c: Context): Promise<Sa4eUser | Response> {
  const user = await getSa4eUser(c);
  if (!user) {
    return c.json(
      { success: false, error: { code: 'ERR_002', message: 'Unauthorized' } },
      401,
    );
  }
  return user;
}
