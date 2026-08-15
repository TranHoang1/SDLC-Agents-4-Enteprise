/**
 * Unit tests for UserRepository — total count, per-group count and email
 * updates against an in-memory users table.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { UserRepository } from '../UserRepository.js';
import { makeTestAdapter } from '../../__tests__/test-adapter.js';

const SCHEMA = `
CREATE TABLE users (
  user_id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', access_group_id TEXT NOT NULL,
  force_password_change INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_login TEXT
);
`;

let db: Database.Database;
let repo: UserRepository;

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(SCHEMA);
  const insert = db.prepare(`INSERT INTO users
    (user_id, username, email, password_hash, status, access_group_id, created_at)
    VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`);
  insert.run('u1', 'alice', 'a@x.com', 'h1', 'grp-admin', '2024-01-01T00:00:00Z');
  insert.run('u2', 'bob', 'b@x.com', 'h2', 'grp-dev', '2024-01-02T00:00:00Z');
  insert.run('u3', 'carol', 'c@x.com', 'h3', 'grp-admin', '2024-01-03T00:00:00Z');
  repo = new UserRepository(makeTestAdapter(db));
});

afterEach(() => db.close());

describe('UserRepository', () => {
  it('getUserCount returns the total number of users', async () => {
    expect(await repo.getUserCount()).toBe(3);
  });

  it('getUserCountByGroup returns users in a group', async () => {
    expect(await repo.getUserCountByGroup('grp-admin')).toBe(2);
    expect(await repo.getUserCountByGroup('grp-viewer')).toBe(0);
  });

  it('updateEmail changes the user email', async () => {
    await repo.updateEmail('u1', 'new@x.com');
    const row = db.prepare('SELECT email FROM users WHERE user_id = ?').get('u1') as { email: string };
    expect(row.email).toBe('new@x.com');
    const other = db.prepare('SELECT email FROM users WHERE user_id = ?').get('u2') as { email: string };
    expect(other.email).toBe('b@x.com');
  });
});