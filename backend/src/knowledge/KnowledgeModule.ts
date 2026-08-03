/**
 * SA4E-85 — Knowledge Module.
 * Wraps KnowledgeService for the ModuleRegistry lifecycle. Exposes the service
 * to route factories via getService(). DB path follows backend convention:
 * <workspace>/.code-intel/knowledge.db (matching memory module data dir).
 */

import type { IModule, ModuleStatus } from '../types/module.js';
import type { ToolHandler, ToolDefinition } from '../types/tool.js';
import type { Logger } from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeDb } from './KnowledgeDb.js';
import { KnowledgeService } from './KnowledgeService.js';

export interface KnowledgeModuleOptions {
  dbPath?: string;
  defaultWorkspace?: string;
  service?: KnowledgeService;
}

export class KnowledgeModule implements IModule {
  readonly name = 'knowledge';
  private _status: ModuleStatus = 'initializing';
  private logger: Logger;
  private db: KnowledgeDb | null = null;
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
        const dbPath = this.options.dbPath ?? this.resolveDefaultDbPath();
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        this.db = new KnowledgeDb(dbPath);
        this.service = new KnowledgeService(this.db, this.logger, {
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
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this._status = 'stopped';
  }

  getToolHandlers(): Map<string, ToolHandler> { return new Map(); }

  getToolDefinitions(): ToolDefinition[] { return []; }

  private resolveDefaultDbPath(): string {
    const dataDir = process.env.CODE_INTEL_DATA_DIR || '.code-intel';
    const workspace = process.env.CODE_INTEL_WORKSPACE || process.cwd();
    return path.resolve(workspace, dataDir, 'knowledge.db');
  }
}
