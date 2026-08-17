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

/** Resolve request scope — uses authenticated userId from session for tenant isolation. */
function resolveRequestScope(c: Context, sessionUserId?: string): IndexScope {
  const config = loadConfig();
  const projectId = requireProjectId(c.req.header('X-Project-Id') || config.projectId);
  const userId = sessionUserId || 'default';
  // indexTempDir/{userId}/{projectId} for source file writes
  const workspace = path.join(config.indexTempDir, userId, projectId);
  if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });
  return { projectId, workspace };
}

/** Extract userId from Bearer token (non-fatal — returns '' if unauthenticated). */
// NOTE: resolveUserId kept for backward compatibility but auth is now enforced at route level

/** Phase: write files to disk under the workspace, rejecting unsafe paths. */
function writeFilesPhase(workspace: string, files: SourceFile[]): { written: number; rejected: string[] } {
  const rejected: string[] = [];
  let written = 0;
  for (const file of files) {
    const targetPath = resolveWithinWorkspace(workspace, file.path);
    if (!targetPath) { rejected.push(file.path); continue; }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, file.content, 'utf-8');
    written++;
  }
  return { written, rejected };
}

/** Phase: register/update the project in the admin registry (non-fatal). */
async function registerProjectPhase(projectId: string, workspace: string, logger: Logger, createdBy = '', realWorkspaceRoot?: string): Promise<void> {
  try {
    const graphRepo = new GraphRepository(getAdminAdapter());
    const displayName = await deriveDisplayName(realWorkspaceRoot || workspace);
    const displayPath = realWorkspaceRoot || workspace;
    await graphRepo.registerProject(projectId, displayName, displayPath, createdBy);
  } catch (err) {
    logger.warn({ err, projectId }, '[index] project registry upsert skipped (non-fatal)');
  }
}

/** Derive human-readable project name: git repo name > folder name. Pega handled separately. */
async function deriveDisplayName(workspaceRoot: string): Promise<string> {
  // 1. Try git repo name from remote URL
  try {
    const { execSync } = await import('child_process');
    const remote = execSync('git remote get-url origin', { cwd: workspaceRoot, encoding: 'utf-8', timeout: 3000 }).trim();
    if (remote) {
      // Parse: https://github.com/org/repo-name.git → repo-name
      // Parse: git@github.com:org/repo-name.git → repo-name
      const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
      if (match) return match[1];
    }
  } catch { /* no git or no remote — fallback */ }
  // 2. Fallback: folder name
  return path.basename(workspaceRoot) || 'Untitled Project';
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
    return handleIndexSource(c, registry, logger, session.userId);
  });
  app.post('/api/index/document', async (c) => {
    const session = await requireAuth(c);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    return handleIndexDocument(c, logger, session.userId);
  });
  app.post('/api/index/documents', async (c) => {
    const session = await requireAuth(c);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    return handleIndexDocuments(c, logger, session.userId);
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
    const scope = resolveRequestScope(c, userId);
    const realWorkspaceRoot = c.req.header('X-Workspace-Root') || '';
    await registerProjectPhase(scope.projectId, scope.workspace, logger, userId, realWorkspaceRoot || undefined);

    const codeIntel = registry.getModule('codeIntel') as CodeIntelModule | undefined;
    const indexer = codeIntel?.getIndexer() as any;

    const written: string[] = [];
    const indexed: string[] = [];
    const indexFailed: string[] = [];
    const skipped: string[] = [];
    const rejected: string[] = [];
    const allDeps: FileDependency[] = [];

    for (const file of files) {
      const targetPath = resolveWithinWorkspace(scope.workspace, file.path);
      if (!targetPath) { rejected.push(file.path); continue; }

      const fileHash = file.gitHash || file.checksum || '';

      if (indexer && fileHash) {
        try {
          const existing = await indexer.adapter.getAsync(
            'SELECT content_hash FROM files WHERE relative_path = ? AND project_id = ?',
            [file.path, scope.projectId],
          ) as { content_hash: string } | undefined;
          if (existing && existing.content_hash === fileHash.slice(0, 16)) {
            skipped.push(file.path);
            continue;
          }
        } catch {
          // Table may not exist yet — proceed with indexing
        }
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, file.content, 'utf-8');
      written.push(file.path);

      // Index single file and collect deps
      if (indexer) {
        try {
          const result = await indexer.indexSingleFile(file.path, scope.projectId);
          if (result && result.symbolCount > 0) {
            indexed.push(file.path);
            if (result.dependencies) {
              for (const dep of result.dependencies) {
                if (!allDeps.some(d => d.path === dep.path)) {
                  allDeps.push(dep);
                }
              }
            }
          } else {
            indexFailed.push(file.path);
          }
        } catch (err) {
          indexFailed.push(file.path);
          logger.warn({ err, file: file.path }, '[index] single-file index failed');
        }
      }
    }

    if (rejected.length > 0) logger.warn({ rejected, projectId: scope.projectId }, '[index] rejected unsafe paths');
    if (indexFailed.length > 0) logger.warn({ count: indexFailed.length, projectId: scope.projectId }, '[index] files written but DB index failed');
    await ensureProjectKbEntry(registry, scope, indexed.length, logger);

    // SA4E-107: Create LLM enrichment tasks for newly indexed symbols (async, non-blocking)
    if (indexer && indexed.length > 0) {
      try {
        const { CodeEnrichmentTaskCreator } = await import('../../engine/enrichment/CodeEnrichmentTaskCreator.js');
        const creator = new CodeEnrichmentTaskCreator(indexer.adapter, logger);
        const created = await creator.createTasksForProject(scope.projectId);
        if (created > 0) logger.info({ created, projectId: scope.projectId }, '[index] Enrichment tasks queued');
      } catch (err) {
        logger.warn({ err }, '[index] Enrichment task creation skipped (non-fatal)');
      }
    }

    return c.json({ written: written.length, indexed: indexed.length, indexFailed: indexFailed.length, skipped: skipped.length, rejected, deps: allDeps, projectId: scope.projectId });
  } catch (err: any) {
    return indexError(c, err, logger, 'Error writing source batch');
  }
}

async function handleIndexDocument(c: Context, logger: Logger, userId = '') {
  try {
    const body = await c.req.json() as { path: string; content: string };
    const { path: relPath, content } = body;
    if (!relPath || !content) return c.json({ error: 'path and content required' }, 400);
    const scope = resolveRequestScope(c, userId);
    const targetPath = resolveWithinWorkspace(scope.workspace, relPath);
    if (!targetPath) return c.json({ error: 'Invalid path' }, 400);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf-8');
    return c.json({ success: true });
  } catch (err: any) {
    return indexError(c, err, logger, 'Error writing document');
  }
}

async function handleIndexDocuments(c: Context, logger: Logger, userId = '') {
  try {
    const body = await c.req.json() as { files: SourceFile[] };
    const { files } = body;
    if (!files || !Array.isArray(files)) return c.json({ error: 'files array required' }, 400);
    const scope = resolveRequestScope(c, userId);
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

