/**
 * SA4E-85 — Knowledge Module.
 * Wraps KnowledgeService for the ModuleRegistry lifecycle. Exposes the service
 * to route factories via getService(). Uses DatabaseAdapter for cross-engine support.
 */

import type { IModule, ModuleStatus } from '../types/module.js';
import type { ToolHandler, ToolDefinition } from '../types/tool.js';
import type { Logger } from 'pino';
import type { QueryDatabaseAdapter } from '../database/adapters/DatabaseAdapter.js';
import { KnowledgeDb } from './KnowledgeDb.js';
import { KnowledgeService } from './KnowledgeService.js';

export interface KnowledgeModuleOptions {
  /** DatabaseAdapter instance (supports SQLite + PG). If omitted, resolves from getAdminAdapter(). */
  adapter?: QueryDatabaseAdapter;
  defaultWorkspace?: string;
  /** Pre-built service (for testing). */
  service?: KnowledgeService;
}

export class KnowledgeModule implements IModule {
  readonly name = 'knowledge';
  private _status: ModuleStatus = 'initializing';
  private logger: Logger;
  private service!: KnowledgeService;

  constructor(logger: Logger, private readonly options: KnowledgeModuleOptions = {}) {
    this.logger = logger.child({ module: this.name });
  }

  get status(): ModuleStatus { return this._status; }

  getService(): KnowledgeService { return this.service; }

  async initialize(): Promise<void> {
    this.logger.info('Initializing knowledge module');
    try {
      if (this.options.service) {
        this.service = this.options.service;
      } else {
        // Resolve adapter: explicit > getAdminAdapter() fallback
        let adapter = this.options.adapter;
        if (!adapter) {
          const { getAdminAdapter } = await import('../admin/db/core.js');
          adapter = getAdminAdapter();
        }
        const db = new KnowledgeDb(adapter);
        await db.migrate();
        this.service = new KnowledgeService(db, this.logger, {
          defaultWorkspace: this.options.defaultWorkspace,
        });
      }
      this._status = 'ready';
      this.logger.info('Knowledge module ready');
    } catch (err) {
      this.logger.error({ err }, 'Failed to initialize knowledge module');
      this._status = 'error';
    }
  }

  async shutdown(): Promise<void> {
    this._status = 'stopped';
  }

  getToolHandlers(): Map<string, ToolHandler> { return new Map(); }

  getToolDefinitions(): ToolDefinition[] { return []; }
}
