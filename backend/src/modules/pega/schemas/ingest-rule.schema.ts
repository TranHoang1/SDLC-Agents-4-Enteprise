/**
 * Zod validation schemas for POST /api/v1/pega/ingest-rule endpoint.
 * SA4E-156: Per-rule ingestion with relative extraction.
 */

import { z } from 'zod';

/** Request body schema — validates projectId format + ruleJson.pxObjClass presence */
export const IngestRuleRequestSchema = z.object({
  projectId: z.string().min(1).max(12).regex(/^[a-f0-9]{12}$/, {
    message: 'projectId must be a 12-character hex string',
  }),
  ruleJson: z.record(z.unknown()).refine(
    (obj) => typeof obj.pxObjClass === 'string' && obj.pxObjClass.length > 0,
    { message: 'ruleJson.pxObjClass is required' },
  ),
  checksum: z.string().optional(),
  version: z.string().optional(),
});

export type IngestRuleRequest = z.infer<typeof IngestRuleRequestSchema>;

/** Schema for a single unresolved dependency in the response */
export const UnresolvedDependencySchema = z.object({
  insKey: z.string().nullable().optional(),
  ruleType: z.string(),
  className: z.string(),
  ruleName: z.string(),
});

/** Response data schema */
export const IngestRuleResponseDataSchema = z.object({
  status: z.enum(['success', 'error']),
  ruleId: z.number().optional(),
  unresolvedDependencies: z.array(UnresolvedDependencySchema).default([]),
  reason: z.string().optional(),
});

/** Full response envelope schema */
export const IngestRuleResponseSchema = z.object({
  data: IngestRuleResponseDataSchema.nullable(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).nullable(),
});

export type IngestRuleResponse = z.infer<typeof IngestRuleResponseSchema>;
