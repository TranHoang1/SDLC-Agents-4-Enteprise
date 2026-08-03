/**
 * SA4E-85 — PBT-HYD-01: thread_id from Backend KB createThread always UUID v4.
 * Property-based testing with fast-check (500 runs, per STC).
 * STC: PBT-HYD-01 — thread_id always valid UUID v4 format.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import pino from 'pino';
import { KnowledgeDb } from '../KnowledgeDb.js';
import { KnowledgeService } from '../KnowledgeService.js';
import { createProjectContext } from '../../modules/memory/ProjectContext.js';
import { isUuidV4, UUID_V4_REGEX } from '../models.js';

const logger = pino({ level: 'silent' });

describe('PBT-HYD-01 — backend thread_id always valid UUID v4', () => {
  it('holds for 500 random createThread inputs', () => {
    const db = KnowledgeDb.createInMemory();
    const service = new KnowledgeService(db, logger);
    const ctx = createProjectContext('pbt-ws', 'pbt-user');

    fc.assert(
      fc.property(
        fc.string({ maxLength: 64 }),
        fc.string({ maxLength: 32 }),
        fc.boolean(),
        (title, agentId, hasAgent) => {
          const thread = service.createThread(ctx, {
            title,
            agent_id: hasAgent ? agentId : null,
          });
          expect(thread.thread_id).toMatch(UUID_V4_REGEX);
          expect(isUuidV4(thread.thread_id)).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('thread ids are unique across creations', () => {
    const db = KnowledgeDb.createInMemory();
    const service = new KnowledgeService(db, logger);
    const ctx = createProjectContext('pbt-ws', 'pbt-user');
    const ids = new Set(Array.from({ length: 100 }, () => service.createThread(ctx, {}).thread_id));
    expect(ids.size).toBe(100);
  });

  it('invalid thread_id strings are rejected by accessors', () => {
    const db = KnowledgeDb.createInMemory();
    const service = new KnowledgeService(db, logger);
    const ctx = createProjectContext('pbt-ws', 'pbt-user');
    fc.assert(
      fc.property(fc.string({ maxLength: 100 }), (badId) => {
        fc.pre(!UUID_V4_REGEX.test(badId));
        expect(service.getThread(ctx, badId)).toBeNull();
        expect(service.getMessages(ctx, badId)).toBeNull();
        expect(service.getCheckpoint(ctx, badId)).toBeNull();
      }),
      { numRuns: 500 },
    );
  });
});
