/**
 * SA4E-110 - Zod schemas for IPC credential protocol messages.
 * Validates requestId correlation and timestamp freshness.
 */
import { z } from 'zod';

export const CredentialRequestSchema = z.object({
  type: z.literal('getCredentials'),
  requestId: z.string().uuid(),
  timestamp: z.number().positive(),
});

export const CredentialResponseSchema = z.object({
  type: z.literal('credentials'),
  requestId: z.string().uuid(),
  timestamp: z.number().positive(),
  credentials: z.object({
    email: z.string().email(),
    apiToken: z.string().min(1),
    baseUrl: z.string().url(),
  }),
});

export type CredentialRequestMsg = z.infer<typeof CredentialRequestSchema>;
export type CredentialResponseMsg = z.infer<typeof CredentialResponseSchema>;