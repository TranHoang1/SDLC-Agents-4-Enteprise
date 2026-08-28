/**
 * SA4E-215 — Database Schema Definitions (ALIGNED TO REAL sa4e_db, verified 2026-08-26).
 *
 * Real platform conventions (DO NOT deviate):
 *  - Primary keys are TEXT ids (e.g. user-admin-001, grp-admin, project_id text)
 *  - JSON is stored as TEXT (e.g. schema_json TEXT)
 *  - Booleans are INTEGER 0/1 (e.g. force_password_change INTEGER)
 *  - Passwords: pbkdf2 `salt:hash` (sha512) — see backend/src/admin/db/password.ts
 *
 * Prerequisite tables that ALREADY EXIST in sa4e_db (documented for reference,
 * NOT created by SA4E-215 migration): users, access_groups, group_permissions,
 * project_registry, audit_log, mcp_tools.
 *
 * SA4E-215 OWNS and creates exactly two new tables: mcp_servers, decisions.
 */

import type { TableDef } from './types.js';

/** mcp_servers — NEW dedicated table for MCP SERVER DECLARATION/CONFIG.
 *  Distinct from mcp_tools (which the server uses to ingest tools for search). */
export const MCP_SERVERS_TABLE: TableDef = {
  name: 'mcp_servers',
  columns: [
    { name: 'server_id', type: 'text', primaryKey: true, notNull: true },
    { name: 'project_id', type: 'text', notNull: true },
    { name: 'name', type: 'text', notNull: true },
    { name: 'transport_type', type: 'text', notNull: true },
    { name: 'url', type: 'text' },
    { name: 'command', type: 'text' },
    { name: 'args', type: 'text' },
    { name: 'env', type: 'text' },
    { name: 'disabled', type: 'integer', notNull: true, default: '0' },
    { name: 'auto_approve', type: 'text' },
    { name: 'tools', type: 'text' },
    { name: 'created_at', type: 'timestamp', notNull: true },
    { name: 'updated_at', type: 'timestamp', notNull: true },
  ],
  indexes: [
    { name: 'idx_mcp_servers_project_id', columns: ['project_id'], unique: false },
    { name: 'idx_mcp_servers_name_project', columns: ['name', 'project_id'], unique: true },
    { name: 'idx_mcp_servers_disabled', columns: ['disabled'], unique: false },
  ],
};

/** decisions — NEW table for decision evaluation results.
 *  Audit trail is written to the EXISTING audit_log table (real shape). */
export const DECISIONS_TABLE: TableDef = {
  name: 'decisions',
  columns: [
    { name: 'decision_id', type: 'text', primaryKey: true, notNull: true },
    { name: 'user_id', type: 'text', notNull: true },
    { name: 'project_id', type: 'text' },
    { name: 'rule_set_id', type: 'text', notNull: true },
    { name: 'input_params', type: 'text' },
    { name: 'result', type: 'text', notNull: true },
    { name: 'confidence', type: 'real', notNull: true, default: '0' },
    { name: 'evaluated_at', type: 'timestamp', notNull: true },
  ],
  indexes: [
    { name: 'idx_decisions_user_id', columns: ['user_id'], unique: false },
    { name: 'idx_decisions_evaluated_at', columns: ['evaluated_at'], unique: false },
    { name: 'idx_decisions_rule_set_id', columns: ['rule_set_id'], unique: false },
  ],
};

/** Reference definitions of prerequisite tables (must exist before SA4E-215 runs).
 *  These mirror sa4e_db EXACTLY and are NOT included in SA4E_215_TABLES. */
export const USERS_TABLE: TableDef = {
  name: 'users',
  columns: [
    { name: 'user_id', type: 'text', primaryKey: true, notNull: true },
    { name: 'username', type: 'text', notNull: true },
    { name: 'email', type: 'text', notNull: true },
    { name: 'password_hash', type: 'text', notNull: true },
    { name: 'status', type: 'text', notNull: true, default: "'ACTIVE'" },
    { name: 'access_group_id', type: 'text', notNull: true },
    { name: 'force_password_change', type: 'integer', notNull: true, default: '0' },
    { name: 'created_at', type: 'timestamp', notNull: true },
    { name: 'last_login', type: 'timestamp' },
  ],
};

export const AUDIT_LOG_TABLE: TableDef = {
  name: 'audit_log',
  columns: [
    { name: 'audit_id', type: 'text', primaryKey: true, notNull: true },
    { name: 'user_id', type: 'text', notNull: true },
    { name: 'username', type: 'text', notNull: true },
    { name: 'action', type: 'text', notNull: true },
    { name: 'resource', type: 'text', notNull: true },
    { name: 'resource_id', type: 'text', notNull: true, default: "''" },
    { name: 'changes', type: 'text', default: "''" },
    { name: 'timestamp', type: 'timestamp', notNull: true },
    { name: 'ip_address', type: 'text', default: "''" },
  ],
};

/** Tables SA4E-215 creates/migrates (only the NEW ones it owns). */
export const SA4E_215_TABLES: TableDef[] = [MCP_SERVERS_TABLE, DECISIONS_TABLE];

/** Table name shorthand. */
export const SA4E_215_TABLE_NAMES = {
  MCP_SERVERS: 'mcp_servers',
  DECISIONS: 'decisions',
} as const;
