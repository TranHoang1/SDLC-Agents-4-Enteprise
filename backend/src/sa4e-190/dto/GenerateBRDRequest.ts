import { z } from 'zod';

export const GenerateBRDRequestSchema = z.object({
  ticketKey: z.string().regex(/^[A-Z]+-\d+$/)
});

export const GenerateBRDResponseSchema = z.object({
  path: z.string(),
  status: z.enum(['success','error'])
});

export type GenerateBRDRequest = z.infer<typeof GenerateBRDRequestSchema>;
export type GenerateBRDResponse = z.infer<typeof GenerateBRDResponseSchema>;
