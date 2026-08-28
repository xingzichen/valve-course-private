import { z } from 'zod';

const evidenceSchema = z.object({
  ref: z.string().trim().min(1),
  // Local models sometimes return only the reference identifier. These fields
  // improve presentation, but they must not invalidate an otherwise usable answer.
  statement: z.string().trim().catch(''),
  sourceType: z.string().trim().catch('档案上下文')
});

export const analysisResponseSchema = z.object({
  answer: z.string().trim().min(1),
  evidence: z.array(evidenceSchema).default([]),
  uncertainties: z.array(z.string()).default([]),
  questionsForDoctor: z.array(z.string()).default([]),
  urgentWarning: z.string().nullable().default(null)
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
