/**
 * SA4E-215 — Database Schema Definitions.
 * Defines tables: users, decisions, audit_log.
 * Maps to Prisma schema and raw DDL for SQLite/PostgreSQL.
 * Implements: TDD.md Section 3.2, FSD.md Section 3.1
 */

import type { ColumnDef, IndexDef, TableDef } from './types.js';

/** Users table – stores registered users with RBAC roles. */
export const USERS_TABLE: TableDef = {
  name: 'users',
  columns: [
    { name: 'id', type: 'serial', primaryKey: true, autoIncrement: true, notNull: true },
    { name: 'email', type: 'varchar(255)', unique: true, notNull: true },
    { name: 'password_hash', type: 'varchar(255)', notNull: true },
    { name: 'role', type: 'varchar(50)', notNull: true, default: "'user'" },
    { name: 'created_at', type: 'timestamp', notNull: true, default: 'now()' },
    { name: 'updated_at', type: 'timestamp', notNull: true, default: 'now()' },
  ],
};

/** Decisions table – stores decision evaluation results with confidence scores. */
export const DECISIONS_TABLE: TableDef = {
  name: 'decisions',
  columns: [
    { name: 'id', type: 'serial', primaryKey: true, autoIncrement: true, notNull: true },
    { name: 'user_id', type: 'integer', notNull: true },
    { name: 'rule_set_id', type: 'varchar(100)', notNull: true },
    { name: 'input_params', type: 'jsonb' },
    { name: 'result', type: 'varchar(50)', notNull: true },
    { name: 'confidence', type: 'real', notNull: true, default: 0 },
    { name: 'evaluated_at', type: 'timestamp', notNull: true, default: 'now()' },
  ],
  indexes: [
    { name: 'idx_decisions_user_id', columns: ['user_id'], unique: false },
    { name: 'idx_decisions_evaluated_at', columns: ['evaluated_at'], unique: false },
    { name: 'idx_decisions_rule_set_id', columns: ['rule_set_id'], unique: false },
  ],
};

/** Audit log table – stores audit trail for all user actions and system events. */
export const AUDIT_LOG_TABLE: TableDef = {
  name: 'audit_log',
  columns: [
    { name: 'id', type: 'serial', primaryKey: true, autoIncrement: true, notNull: true },
    { name: 'user_id', type: 'integer' },
    { name: 'action', type: 'varchar(100)', notNull: true },
    { name: 'resource_type', type: 'varchar(50)', notNull: true },
    { name: 'resource_id', type: 'integer', notNull: true },
    { name: 'metadata', type: 'jsonb', notNull: true, default: '{}' },
    { name: 'created_at', type: 'timestamp', notNull: true, default: 'now()' },
  ],
  indexes: [
    { name: 'idx_audit_log_user_id', columns: ['user_id'], unique: false },
    { name: 'idx_audit_log_action', columns: ['action'], unique: false },
    { name: 'idx_audit_log_created_at', columns: ['created_at'], unique: false },
  ],
};

/** All SA4E-215 tables for registry registration. */
export const SA4E_215_TABLES: TableDef[] = [
  USERS_TABLE,
  DECISIONS_TABLE,
  AUDIT_LOG_TABLE,
];

/** Table name shorthand for queries. */
export const SA4E_215_TABLE_NAMES = {
  USERS: 'users',
  DECISIONS: 'decisions',
  AUDIT_LOG: 'audit_log',
} as const;