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

interface SourceFile { path: string; content: string }
interface IndexScope { projectId: string; workspace: string }

/**
 * Server-controlled root directory that holds per-tenant workspaces.
 * The client's `X-Workspace-Root` (e.g. `/Users/foo/proj` from macOS,
 * `C:\Users\foo\proj` from Windows) is preserved as a subdirectory tree UNDER
 * this root, so operators can still recognise the original layout when
 * inspecting the container (`ls /app/workspaces/<projectId>/Users/foo/proj`).
 *
 * Configure via env var `SERVER_WORKSPACES_ROOT` (default:
 * `<dataDir>/workspaces`, falling back to `.code-intel/workspaces`).
 */
function resolveServerWorkspacesRoot(): string {
  if (process.env.SERVER_WORKSPACES_ROOT) return process.env.SERVER_WORKSPACES_ROOT;
  const cfg = loadConfig();
  return path.resolve(cfg.dataDir || '.code-intel', 'workspaces');
}

/**
 * Sanitize projectId to a filesystem-safe directory name.
 * Allows only `[a-zA-Z0-9._-]`; all other characters become `_`.
 * Rejects the special names `.` and `..` to prevent path traversal.
 */
function sanitizeProjectIdForFs(projectId: string): string {
  const clean = projectId.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!clean || clean === '.' || clean === '..') {
    throw new Error('PROJECT_REQUIRED: project_id contains no filesystem-safe characters');
  }
  return clean;
}

/**
 * Convert the client-supplied host workspace path into a safe container path
 * that mirrors the original hierarchy under the tenant's workspace root.
 *
 * Examples (assuming `SERVER_WORKSPACES_ROOT=/app/workspaces`, projectId=`p1`):
 *   `/Users/foo/proj`      -> `/app/workspaces/p1/Users/foo/proj`
 *   `C:\\Users\\foo\\proj` -> `/app/workspaces/p1/C/Users/foo/proj`
 *
 * The returned path is guaranteed to stay under
 * `<workspacesRoot>/<projectId>/` — any `..` segments that would escape the
 * tenant root are rejected.
 */
function mapClientPathToContainer(hostPath: string, projectId: string): string {
  const projectRoot = path.resolve(resolveServerWorkspacesRoot(), sanitizeProjectIdForFs(projectId));

  // Normalise slashes and strip a Windows drive letter into a plain directory
  // segment so `C:\Users\foo` becomes `C/Users/foo` (avoids `:` on POSIX FS).
  let rel = hostPath.replace(/\\/g, '/');
  const drive = /^([a-zA-Z]):\/?/.exec(rel);
  if (drive) rel = `${drive[1]}/${rel.slice(drive[0].length)}`;
  // Drop leading slashes so path.resolve joins into projectRoot (not to /).
  rel = rel.replace(/^\/+/, '');

  const target = path.resolve(projectRoot, rel);
  const prefix = projectRoot + path.sep;
  if (target !== projectRoot && !target.startsWith(prefix)) {
    throw new Error('WORKSPACE_ESCAPE: workspace path resolves outside tenant root');
  }
  return target;
}

/**
 * Resolve request scope. `projectId` comes from the client; `workspace` is a
 * server-side path derived from the client-supplied `X-Workspace-Root` — the
 * client's hierarchy is preserved, but writes are contained under
 * `<SERVER_WORKSPACES_ROOT>/<projectId>/`. If the header is missing, we fall
 * back to the tenant root itself.
 */
function resolveRequestScope(c: Context): IndexScope {
  const config = loadConfig();
  const projectId = requireProjectId(c.req.header('X-Project-Id') || config.projectId);
  const clientPath = c.req.header('X-Workspace-Root');
  const workspace = clientPath
    ? mapClientPathToContainer(clientPath, projectId)
    : path.resolve(resolveServerWorkspacesRoot(), sanitizeProjectIdForFs(projectId));
  fs.mkdirSync(workspace, { recursive: true });
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
      // level=0 → macro tier (project-level node, always visible at zoom-out).
      tier: 'SEMANTIC', projectId, x: 0, y: 0, z: 0, level: 0, clusterId: '0',
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
    return handleIndexDocument(c, logger);
  });
  app.post('/api/index/documents', async (c) => {
    const session = await requireAuth(c);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    return handleIndexDocuments(c, logger);
  });
}

async function handleIndexSource(c: Context, registry: ModuleRegistry, logger: Logger, userId = '') {
  try {
    const { files } = await c.req.json<{ files: SourceFile[] }>();
    if (!files || !Array.isArray(files)) return c.json({ error: 'files array required' }, 400);
    const scope = resolveRequestScope(c);
    await registerProjectPhase(scope.projectId, scope.workspace, logger, userId);
    const { written, rejected } = writeFilesPhase(scope.workspace, files);
    if (rejected.length > 0) logger.warn({ rejected, projectId: scope.projectId }, '[index] rejected unsafe paths');
    const reindexTriggered = triggerIndexPhase(registry, scope, logger);
    await ensureProjectKbEntry(registry, scope, written, logger);
    return c.json({ written, rejected, reindexTriggered, projectId: scope.projectId });
  } catch (err: any) {
    return indexError(c, err, logger, 'Error writing source batch');
  }
}

async function handleIndexDocument(c: Context, logger: Logger) {
  try {
    const { path: relPath, content } = await c.req.json<{ path: string; content: string }>();
    if (!relPath || !content) return c.json({ error: 'path and content required' }, 400);
    const scope = resolveRequestScope(c);
    const targetPath = resolveWithinWorkspace(scope.workspace, relPath);
    if (!targetPath) return c.json({ error: 'Invalid path' }, 400);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf-8');
    return c.json({ success: true });
  } catch (err: any) {
    return indexError(c, err, logger, 'Error writing document');
  }
}

async function handleIndexDocuments(c: Context, logger: Logger) {
  try {
    const { files } = await c.req.json<{ files: SourceFile[] }>();
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

