import { z } from 'zod';

export const ResetPipelineSchema = z.object({
  ticket: z.string().regex(/^[A-Z]+-\d+$/),
  autonomyLevel: z.enum(['L1','L2','L3']),
  phase: z.enum(['requirements','specification','design','implementation','testing','deployment'])
});

export const ResetPipelineResponseSchema = z.object({
  status: z.enum(['success','error']),
  ticket: z.string(),
  phase: z.string(),
  autonomyLevel: z.string(),
  completedAt: z.string().datetime().optional()
});

export type ResetPipelineRequest = z.infer<typeof ResetPipelineSchema>;
export type ResetPipelineResponse = z.infer<typeof ResetPipelineResponseSchema>;
