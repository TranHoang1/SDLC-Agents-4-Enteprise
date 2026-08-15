/**
 * Unit tests for DatabaseConfigService — defaults, persistence, encrypted
 * credential round-trips and active engine resolution against a temp dir.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DatabaseConfigService } from '../DatabaseConfigService.js';
import type { DatabaseJsonConfig } from '../DatabaseConfigService.js';

let dataDir: string;
let service: DatabaseConfigService;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-config-'));
  service = new DatabaseConfigService(dataDir);
});

afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

const PG_PARAMS = {
  host: 'db.internal', port: 5432, username: 'admin', password: 's3cr3t',
  database: 'sa4e', ssl: false, pool: { min: 1, max: 5 },
} as const;

describe('DatabaseConfigService', () => {
  it('returns default sqlite config when no file exists', () => {
    const cfg = service.load();
    expect(cfg.activeEngine).toBe('sqlite');
    expect(cfg.engines.sqlite.dbPath).toBe('index.db');
    expect(cfg.migration.lastMigration).toBeNull();
    expect(cfg.migration.backupSqlitePaths).toEqual([]);
  });

  it('resolves sqlite dbPath against the dataDir', () => {
    const active = service.getActiveConfig();
    expect(active.engine).toBe('sqlite');
    expect(active.dbPath).toBe(path.join(dataDir, 'index.db'));
  });

  it('save writes a config file and load reads it back', () => {
    const cfg: DatabaseJsonConfig = {
      activeEngine: 'sqlite',
      engines: { sqlite: { dbPath: 'custom.db' } },
      migration: { lastMigration: 'V5', backupSqlitePaths: ['old.db'] },
    };
    service.save(cfg);
    expect(fs.existsSync(path.join(dataDir, 'database.json'))).toBe(true);
    const loaded = service.load();
    expect(loaded.engines.sqlite.dbPath).toBe('custom.db');
    expect(loaded.migration.lastMigration).toBe('V5');
    expect(loaded.migration.backupSqlitePaths).toEqual(['old.db']);
  });

  it('encrypts postgresql password on save and decrypts on load', () => {
    const cfg: DatabaseJsonConfig = {
      activeEngine: 'postgresql',
      engines: { sqlite: { dbPath: 'index.db' }, postgresql: { ...PG_PARAMS } },
      migration: { lastMigration: null, backupSqlitePaths: [] },
    };
    service.save(cfg);
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'database.json'), 'utf-8')) as {
      engines: { postgresql: { password: string } };
    };
    expect(raw.engines.postgresql.password).toMatch(/^ENC:/);
    const loaded = service.load();
    expect(loaded.engines.postgresql!.password).toBe(PG_PARAMS.password);
  });

  it('save does not double-encrypt an already ENC: prefixed password', () => {
    const cfg: DatabaseJsonConfig = {
      activeEngine: 'postgresql',
      engines: { sqlite: { dbPath: 'index.db' }, postgresql: { ...PG_PARAMS, password: 'ENC:already-encrypted' } },
      migration: { lastMigration: null, backupSqlitePaths: [] },
    };
    service.save(cfg);
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'database.json'), 'utf-8')) as {
      engines: { postgresql: { password: string } };
    };
    expect(raw.engines.postgresql.password).toBe('ENC:already-encrypted');
  });

  it('getActiveConfig returns postgresql params', () => {
    const cfg: DatabaseJsonConfig = {
      activeEngine: 'postgresql',
      engines: { sqlite: { dbPath: 'index.db' }, postgresql: { ...PG_PARAMS } },
      migration: { lastMigration: null, backupSqlitePaths: [] },
    };
    service.save(cfg);
    const active = service.getActiveConfig();
    expect(active.engine).toBe('postgresql');
    expect(active.host).toBe(PG_PARAMS.host);
    expect(active.port).toBe(PG_PARAMS.port);
    expect(active.password).toBe(PG_PARAMS.password);
  });

  it('getActiveConfig returns mysql params', () => {
    const cfg: DatabaseJsonConfig = {
      activeEngine: 'mysql',
      engines: {
        sqlite: { dbPath: 'index.db' },
        mysql: { host: 'mysql', port: 3306, username: 'u', password: 'p', database: 'd', ssl: true, pool: { min: 2, max: 8 } },
      },
      migration: { lastMigration: null, backupSqlitePaths: [] },
    };
    service.save(cfg);
    const active = service.getActiveConfig();
    expect(active.engine).toBe('mysql');
    expect(active.host).toBe('mysql');
    expect(active.ssl).toBe(true);
  });

  it('setActiveEngine switches and persists the engine', () => {
    service.setActiveEngine('postgresql', { ...PG_PARAMS });
    const cfg = service.load();
    expect(cfg.activeEngine).toBe('postgresql');
    expect(cfg.engines.postgresql!.host).toBe(PG_PARAMS.host);
    expect(service.getActiveConfig().engine).toBe('postgresql');
  });
});