/**
 * SA4E-101 — Zod schemas for the index status API (request/response validation).
 * Mirrors the contracts in TDD §3. Used for input validation and response typing.
 */

import { z } from 'zod';

/** Request headers for POST /api/index/full. */
export const FullIndexRequestHeaders = z.object({
  authorization: z.string().startsWith('Bearer '),
  'x-project-id': z.string().min(1, 'X-Project-Id required'),
  'x-workspace-root': z.string().optional(),
});

/** Response for POST /api/index/full (SA4E-101: unified 200 + auto-cancel). */
export const FullIndexResponseSchema = z.object({
  operationId: z.string(),
  projectId: z.string(),
  status: z.literal('running'),
  message: z.string(),
  cancelledPrevious: z.boolean(),
  cancelledOperationId: z.string().optional(),
});

/** Checksum skip stats (nullable on cold-path fallback). */
export const ChecksumStatsSchema = z.object({
  files_skipped: z.number().int().min(0),
  files_processed: z.number().int().min(0),
  files_pending: z.number().int().min(0),
}).nullable();

/** Response for GET /api/index/progress. */
export const ProgressResponseSchema = z.object({
  operationId: z.string(),
  status: z.enum(['idle', 'running', 'interrupted', 'completed', 'cancelled', 'failed']),
  phase: z.enum(['idle', 'scanning', 'indexing', 'resolving', 'complete', 'cancelled', 'error']),
  current: z.number().int().min(0),
  total: z.number().int().min(0),
  percentage: z.number().int().min(0).max(100),
  currentFile: z.string().optional(),
  startedAt: z.string(),
  updatedAt: z.string().optional(),
  elapsedMs: z.number().min(0),
  checksumStats: ChecksumStatsSchema,
});
