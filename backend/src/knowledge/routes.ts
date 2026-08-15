/**
 * SA4E-85 — Knowledge REST API routes.
 * Security requirements (SECURITY-REVIEW v3.1):
 *  - #19: jwtAuth on all /api/v1/threads* routes + localhostOnly guard
 *  - #23: rateLimiter on threads + 10MB bodyLimit cap on checkpoint PUT
 *  - #18: workspace binding enforced in KnowledgeService → 404 on mismatch
 * Checkpoint bodies are NEVER logged.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Logger } from 'pino';
import { jwtAuth } from '../server/middleware/jwt-auth.js';
import { rateLimiter } from '../server/middleware/rate-limiter.js';
import { localhostOnly } from '../server/middleware/localhost-only.js';
import type { KnowledgeService } from './KnowledgeService.js';
import type { ProjectContext } from '../modules/memory/ProjectContext.js';

type KnowledgeEnv = { Variables: { projectContext: ProjectContext } };

export interface KnowledgeApiOptions {
  checkpointBodyLimitBytes?: number;
}

const DEFAULT_CHECKPOINT_BODY_LIMIT = 10 * 1024 * 1024;

function notFound(c: Context<KnowledgeEnv>) {
  return c.json(
    { data: null, error: { code: 'THREAD_NOT_FOUND', message: 'Thread not found' } },
    404,
  );
}

export function createKnowledgeApiRoutes(
  service: KnowledgeService,
  logger: Logger,
  options: KnowledgeApiOptions = {},
): Hono<KnowledgeEnv> {
  const api = new Hono<KnowledgeEnv>();
  api.use('*', localhostOnly);
  api.use('*', jwtAuth);
  api.use('*', rateLimiter);

  api.get('/threads', async (c) => {
    const ctx = c.get('projectContext');
    return c.json({ data: await service.listThreads(ctx), error: null });
  });

  api.post('/threads', async (c) => {
    const ctx = c.get('projectContext');
    const body = await c.req.json<{ title?: string; agent_id?: string | null }>().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ data: null, error: { code: 'INVALID_REQUEST', message: 'Body must be a JSON object' } }, 400);
    }
    const thread = await service.createThread(ctx, body);
    logger.info({ thread_id: thread.thread_id }, 'POST /threads -> 201');
    return c.json({ data: thread, error: null }, 201);
  });

  api.get('/threads/:id', async (c) => {
    const ctx = c.get('projectContext');
    const thread = await service.getThread(ctx, c.req.param('id'));
    if (!thread) return notFound(c);
    return c.json({ data: thread, error: null });
  });

  api.get('/threads/:id/messages', async (c) => {
    const ctx = c.get('projectContext');
    const messages = await service.getMessages(ctx, c.req.param('id'));
    if (messages === null) return notFound(c);
    return c.json({ data: messages, error: null });
  });

  api.get('/threads/:id/checkpoint', async (c) => {
    const ctx = c.get('projectContext');
    const checkpoint = await service.getCheckpoint(ctx, c.req.param('id'));
    if (checkpoint === null) return notFound(c);
    return c.json({ data: checkpoint, error: null });
  });

  api.put(
    '/threads/:id/checkpoint',
    bodyLimit({
      maxSize: options.checkpointBodyLimitBytes ?? DEFAULT_CHECKPOINT_BODY_LIMIT,
      onError: (c) => c.json(
        { data: null, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Checkpoint body exceeds size limit' } },
        413,
      ),
    }),
    async (c) => {
      const ctx = c.get('projectContext');
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return c.json({ data: null, error: { code: 'INVALID_REQUEST', message: 'Checkpoint body must be a JSON object' } }, 400);
      }
      const checkpoint = await service.saveCheckpoint(ctx, c.req.param('id'), body);
      if (!checkpoint) return notFound(c);
      logger.info({ thread_id: c.req.param('id'), version: checkpoint.version }, 'PUT checkpoint -> 200');
      return c.json({ data: checkpoint, error: null });
    },
  );

  api.get('/threads/:id/events', async (c) => {
    const ctx = c.get('projectContext');
    const events = await service.getEvents(ctx, c.req.param('id'));
    if (events === null) return notFound(c);
    return c.json({ data: events, error: null });
  });

  api.get('/threads/:id/artifacts', async (c) => {
    const ctx = c.get('projectContext');
    const artifacts = await service.getArtifacts(ctx, c.req.param('id'));
    if (artifacts === null) return notFound(c);
    return c.json({ data: artifacts, error: null });
  });

  api.get('/agents', async (c) => c.json({ data: await service.getAgents(), error: null }));

  api.delete('/threads/:id', async (c) => {
    const ctx = c.get('projectContext');
    const threadId = c.req.param('id');
    const deleted = await service.deleteThread(ctx, threadId);
    if (!deleted) return notFound(c);
    logger.info({ thread_id: threadId }, 'DELETE thread -> 200');
    return c.json({ data: { deleted: true, thread_id: threadId }, error: null });
  });

  return api;
}
