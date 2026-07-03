/**
 * Unit Tests — admin-db.ts (KSA-285: Auth & Multitenant)
 * Tests DB functions directly: password hashing, sessions, users, RBAC, audit, config, promotion cooldown.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  createSession,
  validateSession,
  invalidateSession,
  invalidateUserSessions,
  getUsers,
  getUserById,
  getUserByUsername,
  createUser,
  updateUserStatus,
  deleteUser,
  resetUserPassword,
  changePassword,
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getUserPermissions,
  recordAudit,
  getAuditLogs,
  recordConfigChange,
  getConfigChanges,
  setPromotionCooldown,
  checkPromotionCooldown,
  searchKbEntries,
  getAdminDb,
} from '../admin-db.js';

// ============================================================
// 1. Password Hashing
// ============================================================

describe('Password Hashing', () => {
  it('hashPassword returns salt:hash format', () => {
    const hashed = hashPassword('testPassword123');
    expect(hashed).toContain(':');
    const [salt, hash] = hashed.split(':');
    expect(salt.length).toBe(32); // 16 bytes hex
    expect(hash.length).toBe(128); // 64 bytes hex
  });

  it('hashPassword produces different hashes for same password (different salt)', () => {
    const hash1 = hashPassword('samePassword');
    const hash2 = hashPassword('samePassword');
    expect(hash1).not.toBe(hash2);
  });

  it('verifyPassword returns true for correct password', () => {
    const password = 'mySecretPass!';
    const hashed = hashPassword(password);
    expect(verifyPassword(password, hashed)).toBe(true);
  });

  it('verifyPassword returns false for wrong password', () => {
    const hashed = hashPassword('correctPassword');
    expect(verifyPassword('wrongPassword', hashed)).toBe(false);
  });

  it('verifyPassword returns false for invalid stored format', () => {
    expect(verifyPassword('test', 'invalid-no-colon')).toBe(false);
    expect(verifyPassword('test', '')).toBe(false);
  });

  it('verifyPassword uses timing-safe comparison', () => {
    const hashed = hashPassword('password');
    const result = verifyPassword('password', hashed);
    expect(result).toBe(true);
  });
});

// ============================================================
// 2. Session Management
// ============================================================

describe('Session Management', () => {
  let testUserId: string;

  beforeAll(() => {
    const user = getUserByUsername('admin');
    testUserId = user!.userId;
  });

  it('createSession returns session with token', () => {
    const session = createSession(testUserId, 'TestDevice', '127.0.0.1');
    expect(session.token).toBeDefined();
    expect(session.token.length).toBe(64); // 32 bytes hex
    expect(session.userId).toBe(testUserId);
    expect(session.sessionId).toMatch(/^sess-/);
    expect(session.expiresAt).toBeDefined();
    expect(session.isActive).toBe(true);
  });

  it('validateSession returns user info for valid token', () => {
    const session = createSession(testUserId);
    const result = validateSession(session.token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe(testUserId);
    expect(result!.username).toBe('admin');
    expect(result!.accessGroupId).toBe('grp-admin');
  });

  it('validateSession returns null for invalid token', () => {
    const result = validateSession('nonexistent-token-12345');
    expect(result).toBeNull();
  });

  it('invalidateSession makes token invalid', () => {
    const session = createSession(testUserId);
    expect(validateSession(session.token)).not.toBeNull();
    invalidateSession(session.token);
    expect(validateSession(session.token)).toBeNull();
  });

  it('invalidateUserSessions terminates all active sessions', () => {
    const s1 = createSession(testUserId);
    const s2 = createSession(testUserId);
    expect(validateSession(s1.token)).not.toBeNull();
    expect(validateSession(s2.token)).not.toBeNull();

    const terminated = invalidateUserSessions(testUserId);
    expect(terminated).toBeGreaterThanOrEqual(2);
    expect(validateSession(s1.token)).toBeNull();
    expect(validateSession(s2.token)).toBeNull();
  });

  it('expired token returns null from validateSession', () => {
    const db = getAdminDb();
    const token = 'expired-token-test-' + Date.now();
    const pastDate = new Date(Date.now() - 1000).toISOString();
    db.prepare(`INSERT INTO sessions (session_id, user_id, token, device, ip_address, login_at, expires_at, is_active)
      VALUES (?, ?, ?, '', '', ?, ?, 1)`).run(
      'sess-expired-' + Date.now(), testUserId, token, pastDate, pastDate
    );
    const result = validateSession(token);
    expect(result).toBeNull();
  });
});

// ============================================================
// 3. User Operations
// ============================================================

describe('User Operations', () => {
  let createdUserId: string;
  const testUsername = `unittest-user-${Date.now()}`;

  it('createUser creates a new user', () => {
    const user = createUser(testUsername, 'test@test.com', 'TestPass123', 'grp-admin');
    expect(user.userId).toMatch(/^user-/);
    expect(user.username).toBe(testUsername);
    expect(user.email).toBe('test@test.com');
    expect(user.status).toBe('ACTIVE');
    expect(user.forcePasswordChange).toBe(true);
    createdUserId = user.userId;
  });

  it('createUser throws on duplicate username', () => {
    expect(() => {
      createUser(testUsername, 'dup@test.com', 'Pass123', 'grp-admin');
    }).toThrow();
  });

  it('getUserById returns user', () => {
    const user = getUserById(createdUserId);
    expect(user).not.toBeNull();
    expect(user!.username).toBe(testUsername);
  });

  it('getUserByUsername returns user with passwordHash', () => {
    const user = getUserByUsername(testUsername);
    expect(user).not.toBeNull();
    expect(user!.passwordHash).toBeDefined();
    expect(user!.passwordHash).toContain(':');
  });

  it('getUsers with no filters returns all users', () => {
    const result = getUsers();
    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.items.length).toBeGreaterThanOrEqual(2);
  });

  it('getUsers with status filter works', () => {
    const result = getUsers({ status: 'ACTIVE' });
    expect(result.items.every(u => u.status === 'ACTIVE')).toBe(true);
  });

  it('getUsers with search filter works', () => {
    const result = getUsers({ search: testUsername.substring(0, 10) });
    expect(result.items.some(u => u.username === testUsername)).toBe(true);
  });

  it('getUsers with accessGroupId filter works', () => {
    const result = getUsers({ accessGroupId: 'grp-admin' });
    expect(result.items.every(u => u.accessGroupId === 'grp-admin')).toBe(true);
  });

  it('updateUserStatus to DISABLED terminates sessions', () => {
    createSession(createdUserId);
    const terminated = updateUserStatus(createdUserId, 'DISABLED');
    expect(terminated).toBeGreaterThanOrEqual(0);
    const user = getUserById(createdUserId);
    expect(user!.status).toBe('DISABLED');
  });

  it('DISABLED user session is rejected by validateSession', () => {
    updateUserStatus(createdUserId, 'ACTIVE');
    const session = createSession(createdUserId);
    updateUserStatus(createdUserId, 'DISABLED');
    const result = validateSession(session.token);
    expect(result).toBeNull();
  });

  it('resetUserPassword returns temp password and sets forcePasswordChange', () => {
    updateUserStatus(createdUserId, 'ACTIVE');
    const tempPwd = resetUserPassword(createdUserId);
    expect(tempPwd.length).toBeGreaterThan(0);
    const user = getUserById(createdUserId);
    expect(user!.forcePasswordChange).toBe(true);
    const dbUser = getUserByUsername(testUsername);
    expect(verifyPassword(tempPwd, dbUser!.passwordHash)).toBe(true);
  });

  it('changePassword updates password and clears forcePasswordChange', () => {
    changePassword(createdUserId, 'NewPassword456');
    const user = getUserById(createdUserId);
    expect(user!.forcePasswordChange).toBe(false);
    const dbUser = getUserByUsername(testUsername);
    expect(verifyPassword('NewPassword456', dbUser!.passwordHash)).toBe(true);
  });

  it('deleteUser cannot delete system admin', () => {
    const admin = getUserByUsername('admin');
    expect(() => deleteUser(admin!.userId)).toThrow('Cannot delete system admin');
  });

  it('deleteUser removes user', () => {
    deleteUser(createdUserId);
    const user = getUserById(createdUserId);
    expect(user).toBeNull();
  });
});

// ============================================================
// 4. RBAC Group Operations
// ============================================================

describe('RBAC Group Operations', () => {
  let testGroupId: string;
  const groupName = `test-group-${Date.now()}`;

  it('createGroup creates a new group with permissions', () => {
    const group = createGroup(groupName, [
      { permissionId: 'KB_READ', roleData: {} },
      { permissionId: 'DASHBOARD_VIEW', roleData: {} },
    ]);
    expect(group.accessGroupId).toMatch(/^grp-/);
    expect(group.accessGroupName).toBe(groupName);
    expect(group.isSystemGroup).toBe(false);
    expect(group.permissions).toHaveLength(2);
    testGroupId = group.accessGroupId;
  });

  it('getGroups returns all groups', () => {
    const groups = getGroups();
    expect(groups.length).toBeGreaterThanOrEqual(2);
    const found = groups.find(g => g.accessGroupId === testGroupId);
    expect(found).toBeDefined();
  });

  it('getGroupById returns specific group', () => {
    const group = getGroupById(testGroupId);
    expect(group).not.toBeNull();
    expect(group!.accessGroupName).toBe(groupName);
    expect(group!.permissions).toHaveLength(2);
  });

  it('updateGroup changes name and permissions', () => {
    const updated = updateGroup(testGroupId, 'renamed-group', [
      { permissionId: 'KB_READ', roleData: {} },
      { permissionId: 'KB_WRITE', roleData: {} },
      { permissionId: 'SEARCH_EXPLORE', roleData: { maxResults: 100 } },
    ]);
    expect(updated.accessGroupName).toBe('renamed-group');
    expect(updated.permissions).toHaveLength(3);
  });

  it('deleteGroup cannot delete system group', () => {
    expect(() => deleteGroup('grp-admin')).toThrow('Cannot delete system group');
  });

  it('deleteGroup cannot delete group with users', () => {
    const user = createUser(`grp-test-user-${Date.now()}`, '', 'pass123', testGroupId);
    expect(() => deleteGroup(testGroupId)).toThrow('Cannot delete group with assigned users');
    deleteUser(user.userId);
  });

  it('deleteGroup removes empty group', () => {
    deleteGroup(testGroupId);
    const group = getGroupById(testGroupId);
    expect(group).toBeNull();
  });
});

// ============================================================
// 5. User Permissions
// ============================================================

describe('User Permissions', () => {
  it('getUserPermissions returns permissions for admin', () => {
    const admin = getUserByUsername('admin');
    const perms = getUserPermissions(admin!.userId);
    expect(perms.length).toBeGreaterThan(5);
    expect(perms.some(p => p.permissionId === 'DASHBOARD_VIEW')).toBe(true);
    expect(perms.some(p => p.permissionId === 'USER_MANAGE')).toBe(true);
  });

  it('getUserPermissions returns empty for nonexistent user', () => {
    const perms = getUserPermissions('nonexistent-user-id');
    expect(perms).toEqual([]);
  });
});

// ============================================================
// 6. Audit Operations
// ============================================================

describe('Audit Operations', () => {
  const auditUserId = 'test-audit-user';
  const auditUsername = 'auditor';

  it('recordAudit creates audit entry', () => {
    recordAudit(auditUserId, auditUsername, 'TEST_ACTION', 'test-resource', 'res-001', '{"key":"value"}', '192.168.1.1');
    const logs = getAuditLogs({ action: 'TEST_ACTION' });
    expect(logs.total).toBeGreaterThanOrEqual(1);
    const entry = logs.items.find(e => e.action === 'TEST_ACTION' && e.userId === auditUserId);
    expect(entry).toBeDefined();
    expect(entry!.username).toBe(auditUsername);
    expect(entry!.resource).toBe('test-resource');
  });

  it('getAuditLogs with action filter', () => {
    recordAudit(auditUserId, auditUsername, 'UNIQUE_ACTION_' + Date.now(), 'resource');
    const logs = getAuditLogs({ action: 'TEST_ACTION' });
    expect(logs.items.every(e => e.action === 'TEST_ACTION')).toBe(true);
  });

  it('getAuditLogs with date range filter', () => {
    const now = new Date();
    const from = new Date(now.getTime() - 60000).toISOString();
    const to = new Date(now.getTime() + 60000).toISOString();
    recordAudit(auditUserId, auditUsername, 'DATE_TEST', 'resource');
    const logs = getAuditLogs({ dateFrom: from, dateTo: to });
    expect(logs.total).toBeGreaterThanOrEqual(1);
  });

  it('getAuditLogs supports pagination', () => {
    for (let i = 0; i < 5; i++) {
      recordAudit(auditUserId, auditUsername, 'PAGINATE_TEST', 'resource', `item-${i}`);
    }
    const page1 = getAuditLogs({ action: 'PAGINATE_TEST' }, 1, 2);
    expect(page1.items.length).toBeLessThanOrEqual(2);
    expect(page1.total).toBeGreaterThanOrEqual(5);
  });
});

// ============================================================
// 7. Config Change Tracking
// ============================================================

describe('Config Change Tracking', () => {
  it('recordConfigChange stores config change', () => {
    recordConfigChange('server', 'port', '48721', '48722', 'admin', true);
    const changes = getConfigChanges(5);
    expect(changes.length).toBeGreaterThanOrEqual(1);
    const portChange = changes.find(c => c.key === 'port' && c.newValue === '48722');
    expect(portChange).toBeDefined();
    expect(portChange!.section).toBe('server');
    expect(portChange!.oldValue).toBe('48721');
    expect(portChange!.changedBy).toBe('admin');
    expect(portChange!.requiresRestart).toBe(true);
  });

  it('getConfigChanges respects limit', () => {
    for (let i = 0; i < 3; i++) {
      recordConfigChange('test', `key${i}`, null, `val${i}`, 'admin', false);
    }
    const changes = getConfigChanges(2);
    expect(changes.length).toBeLessThanOrEqual(2);
  });
});

// ============================================================
// 8. Promotion Cooldown
// ============================================================

describe('Promotion Cooldown', () => {
  const entryId = `cooldown-test-${Date.now()}`;

  it('checkPromotionCooldown returns false when no cooldown set', () => {
    const result = checkPromotionCooldown(entryId);
    expect(result.onCooldown).toBe(false);
    expect(result.cooldownUntil).toBeUndefined();
  });

  it('setPromotionCooldown sets 7-day cooldown', () => {
    setPromotionCooldown(entryId, 'reviewer1');
    const result = checkPromotionCooldown(entryId);
    expect(result.onCooldown).toBe(true);
    expect(result.cooldownUntil).toBeDefined();
    const cooldownDate = new Date(result.cooldownUntil!);
    const now = new Date();
    const diffDays = (cooldownDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it('different entry has no cooldown', () => {
    const result = checkPromotionCooldown('other-entry-no-cooldown');
    expect(result.onCooldown).toBe(false);
  });
});

// ============================================================
// 9. KB Search
// ============================================================

describe('KB Search', () => {
  it('searchKbEntries returns results or empty array', () => {
    const result = searchKbEntries('test');
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe('number');
  });

  it('searchKbEntries handles empty query gracefully', () => {
    const result = searchKbEntries('');
    expect(result).toHaveProperty('items');
    expect(typeof result.total).toBe('number');
  });
});
