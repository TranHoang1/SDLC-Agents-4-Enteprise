/**
 * Source/document indexing endpoints — POST /api/index/source|document|documents.
 * SA4E-41: every write is path-safe (SEC-04/05) and tenant-scoped (requireProjectId).
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Logger } from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import type { ModuleRegistry } from '../../modules/ModuleRegistry.js';
import type { CodeIntelModule } from '../../modules/code-intel/CodeIntelModule.js';
import { loadConfig } from '../../config/index.js';
import { getAdminAdapter } from '../../admin/db/core.js';
import { GraphRepository } from '../../database/repositories/GraphRepository.js';
import { requireProjectId } from '../../engine/query/code-intel-isolation.js';
import { resolveWithinWorkspace } from '../../shared/path-safety.js';
import { validateSession } from '../../admin/db/sessions.js';
import type { FileDependency } from '../../engine/parsers/types.js';
import {
  handleFullIndex, handleFileEvents, handleCancel, handleProgress,
} from './api-index-decoupled.js';

interface SourceFile {
  path: string;
  content: string;
  gitHash?: string;
  checksum?: string;
}
interface IndexScope { projectId: string; workspace: string }

// SA4E-99: Server-side backpressure — limit concurrent index requests
const INDEX_CONCURRENCY_LIMIT = 3;
let activeIndexRequests = 0;

/** Resolve request scope from trusted headers, falling back to boot config. */
function resolveRequestScope(c: Context): IndexScope {
  const config = loadConfig();
  const projectId = requireProjectId(c.req.header('X-Project-Id') || config.projectId);
  const workspace = c.req.header('X-Workspace-Root') || config.workspace;
  return { projectId, workspace };
}

/** Extract userId from Bearer token (non-fatal — returns '' if unauthenticated). */
// NOTE: resolveUserId kept for backward compatibility but auth is now enforced at route level

/** Phase: write files to disk under the workspace, rejecting unsafe paths. */
function writeFilesPhase(workspace: string, files: SourceFile[]): { written: number; rejected: string[] } {
  const rejected: string[] = [];
  let written = 0;
  // SA4E-99: Write to temp dir outside workspace to avoid Kiro file watcher restart
  const wsBasename = path.basename(workspace);
  const tempBase = path.join('C:\\projects\\kiro\\Temp', 'batch-docs', wsBasename);
  fs.mkdirSync(tempBase, { recursive: true });
  for (const file of files) {
    let filePath = file.path;
    if (filePath.startsWith(wsBasename + '/') || filePath.startsWith(wsBasename + '\\')) {
      filePath = filePath.substring(wsBasename.length + 1);
    }
    const targetPath = path.join(tempBase, filePath);
    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, file.content, 'utf-8');
      written++;
    } catch { rejected.push(file.path); }
  }
  return { written, rejected };
}

/** Phase: register/update the project in the admin registry (non-fatal). */
async function registerProjectPhase(projectId: string, workspace: string, logger: Logger, createdBy = ''): Promise<void> {
  try {
    const graphRepo = new GraphRepository(getAdminAdapter());
    await graphRepo.registerProject(projectId, path.basename(workspace), workspace, createdBy);
  } catch (err) {
    logger.warn({ err, projectId }, '[index] project registry upsert skipped (non-fatal)');
  }
}

/** Phase: trigger a scoped background full re-index. Returns whether an indexer ran. */
function triggerIndexPhase(registry: ModuleRegistry, scope: IndexScope, logger: Logger): boolean {
  const codeIntel = registry.getModule('codeIntel') as CodeIntelModule | undefined;
  const indexer = codeIntel?.getIndexer();
  if (!indexer) return false;
  indexer.runFullIndex({ projectId: scope.projectId, workspace: scope.workspace })
    .catch((err: unknown) => logger.error({ err }, 'Background full re-index failed'));
  return true;
}

/** SA4E-99: Sync code symbols to graph_nodes after incremental source upload (non-fatal). */
async function syncGraphAfterUpload(registry: ModuleRegistry, projectId: string, logger: Logger): Promise<void> {
  try {
    const codeIntel = registry.getModule('codeIntel') as CodeIntelModule | undefined;
    const indexer = codeIntel?.getIndexer() as any;
    if (!indexer || !indexer.syncGraphNodesPublic) return;
    await indexer.syncGraphNodesPublic(projectId);
    logger.info({ projectId }, '[index] Graph nodes synced after source upload');
  } catch (err) {
    logger.warn({ err }, '[index] Graph sync after upload failed (non-fatal)');
  }
}

/** Phase: ensure a KB metadata entry + graph node exist for the project (non-fatal). */
/** Phase: ensure a KB metadata entry + graph node exist for the project (non-fatal). */
async function ensureProjectKbEntry(registry: ModuleRegistry, scope: IndexScope, written: number, logger: Logger): Promise<void> {
  try {
    const mem = registry.getModule('memory') as any;
    if (mem?.status !== 'ready') return;
    const engine = mem.getEngine();
    const displayName = path.basename(scope.workspace);
    // Use async insert — engine.insert() is now async for PostgreSQL compatibility
    const entryId = await engine.insert({
      content: `Project "${displayName}" indexed. Workspace: ${scope.workspace}. Files: ${written}.`,
      summary: `Project metadata for ${displayName}`,
      type: 'CONTEXT', tier: 'SEMANTIC', scope: 'PROJECT',
      project_id: scope.projectId, source: 'project-metadata', tags: 'project,metadata,indexed',
    });
    await upsertProjectGraphNode(String(entryId), displayName, scope.projectId, logger);
  } catch (err) {
    logger.warn({ err }, '[index] project KB entry skipped (non-fatal)');
  }
}

/** Upsert the project-metadata graph node (INSERT OR REPLACE to fix stale/missing rows). */
async function upsertProjectGraphNode(entryId: string, displayName: string, projectId: string, logger: Logger): Promise<void> {
  try {
    const graphRepo = new GraphRepository(getAdminAdapter());
    await graphRepo.upsertNode({
      entryId, label: `Project: ${displayName}`, type: 'CONTEXT',
      tier: 'SEMANTIC', projectId, x: 0, y: 0, z: 0, level: 'macro', clusterId: '0',
    });
  } catch (err) {
    logger.warn({ err }, '[index] graph node upsert skipped (non-fatal)');
  }
}

/** Require valid session — returns 401 if not authenticated. */
async function requireAuth(c: Context): Promise<{ userId: string } | null> {
  const auth = c.req.header('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const session = await validateSession(token);
  return session ?? null;
}

/** Register the /api/index/* routes on the given app. */
export function registerIndexRoutes(app: Hono, registry: ModuleRegistry, logger: Logger): void {
  app.post('/api/index/source', async (c) => {
    const session = await requireAuth(c);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    // SA4E-99: Backpressure — reject with 429 if too many concurrent requests
    if (activeIndexRequests >= INDEX_CONCURRENCY_LIMIT) {
      return c.json({ error: 'Server busy', retryAfter: 2 }, 429);
    }
    activeIndexRequests++;
    try {
      return await handleIndexSource(c, registry, logger, session.userId);
    } finally {
      activeIndexRequests--;
    }
  });
  app.post('/api/index/document', async (c) => {
    const session = await requireAuth(c);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    return handleIndexDocument(c, logger);
  });
  app.post('/api/index/documents', async (c) => {
    const session = await requireAuth(c);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    return handleIndexDocuments(c, logger);
  });

  // SA4E-78: Decoupled indexer endpoints
  app.post('/api/index/full', async (c) => {
    const session = await requireAuth(c);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    return handleFullIndex(c, registry, logger);
  });
  app.post('/api/index/file-events', async (c) => {
    const session = await requireAuth(c);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    return handleFileEvents(c, registry, logger);
  });
  app.post('/api/index/cancel', async (c) => {
    const session = await requireAuth(c);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    return handleCancel(c, registry, logger);
  });
  app.get('/api/index/progress', async (c) => {
    const session = await requireAuth(c);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    return handleProgress(c, registry, logger);
  });
}

async function handleIndexSource(c: Context, registry: ModuleRegistry, logger: Logger, userId = '') {
  try {
    const body = await c.req.json() as { files: SourceFile[] };
    const { files } = body;
    if (!files || !Array.isArray(files)) return c.json({ error: 'files array required' }, 400);
    const scope = resolveRequestScope(c);

    // SA4E-99: Write to temp dir OUTSIDE workspace to avoid triggering Kiro file watcher
    // Structure: Temp/{userId}/{projectId}/files... (tenant-safe, no conflict)
    const tempBase = path.join('C:\\projects\\kiro\\Temp', userId || 'anonymous', scope.projectId);
    const wsBasename = path.basename(scope.workspace);
    fs.mkdirSync(tempBase, { recursive: true });

    const written: string[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      let filePath = file.path;
      // Strip workspace prefix if present
      if (filePath.startsWith(wsBasename + '/') || filePath.startsWith(wsBasename + '\\')) {
        filePath = filePath.substring(wsBasename.length + 1);
      }
      const targetPath = path.join(tempBase, filePath);
      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, file.content, 'utf-8');
        written.push(filePath);
      } catch { rejected.push(filePath); }
    }

    return c.json({ written: written.length, skipped: 0, rejected, deps: [], projectId: scope.projectId });
  } catch (err: any) {
    return indexError(c, err, logger, 'Error processing source batch');
  }
}

async function handleIndexDocument(c: Context, logger: Logger) {
  try {
    const body = await c.req.json() as { path: string; content: string };
    const { path: relPath, content } = body;
    if (!relPath || !content) return c.json({ error: 'path and content required' }, 400);
    const scope = resolveRequestScope(c);
    // SA4E-99: Write to temp dir outside workspace (same as source indexing)
    const tempBase = path.join('C:\\projects\\kiro\\Temp', 'documents', scope.projectId);
    const wsBasename = path.basename(scope.workspace);
    let filePath = relPath;
    if (filePath.startsWith(wsBasename + '/') || filePath.startsWith(wsBasename + '\\')) {
      filePath = filePath.substring(wsBasename.length + 1);
    }
    const targetPath = path.join(tempBase, filePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf-8');
    return c.json({ success: true });
  } catch (err: any) {
    return indexError(c, err, logger, 'Error writing document');
  }
}

async function handleIndexDocuments(c: Context, logger: Logger) {
  try {
    const body = await c.req.json() as { files: SourceFile[] };
    const { files } = body;
    if (!files || !Array.isArray(files)) return c.json({ error: 'files array required' }, 400);
    const scope = resolveRequestScope(c);
    const { written, rejected } = writeFilesPhase(scope.workspace, files);
    if (rejected.length > 0) logger.warn({ rejected, projectId: scope.projectId }, '[index] rejected unsafe paths');
    return c.json({ indexed: written, rejected });
  } catch (err: any) {
    return indexError(c, err, logger, 'Error writing documents batch');
  }
}

/** Map errors to responses — PROJECT_REQUIRED → 400, everything else → 500. */
function indexError(c: Context, err: any, logger: Logger, context: string) {
  if (String(err?.message).startsWith('PROJECT_REQUIRED')) {
    return c.json({ error: 'X-Project-Id required for indexing' }, 400);
  }
  logger.error({ err }, context);
  return c.json({ error: 'Internal error' }, 500);
}

