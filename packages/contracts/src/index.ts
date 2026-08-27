import { z } from 'zod';

export const sourceTypeSchema = z.enum([
  'TREATING_DOCTOR_ORDER',
  'PERSONALIZED_SECOND_OPINION',
  'DOCTOR_EXPLANATION',
  'MEDICAL_GUIDELINE',
  'DRUG_LABEL',
  'ONLINE_EDUCATION',
  'PATIENT_EXPERIENCE',
  'USER_INFERENCE',
  'AI_ANALYSIS',
  'DEVICE_DATA',
  'UNKNOWN'
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const verificationStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'SUPERSEDED']);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const dataNatureSchema = z.enum([
  'MEASURED',
  'USER_ENTERED',
  'ALGORITHM_ESTIMATE',
  'ALGORITHM_CLASSIFICATION',
  'NOTIFICATION'
]);
export type DataNature = z.infer<typeof dataNatureSchema>;

export const orderStatusSchema = z.enum([
  'PENDING_CHOICE',
  'PENDING_CONFIRMATION',
  'ACTIVE',
  'COMPLETED',
  'STOPPED',
  'REVOKED'
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const documentStatusSchema = z.enum([
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'REVIEW_REQUIRED',
  'CONFIRMED',
  'FAILED'
]);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const extractedFactSchema = z.object({
  fieldKey: z.string().min(1),
  label: z.string().min(1),
  valueText: z.string(),
  valueNumeric: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  pageNumber: z.number().int().positive().nullable().optional(),
  originalText: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  highRisk: z.boolean().default(false)
});
export type ExtractedFactPayload = z.infer<typeof extractedFactSchema>;

export const documentExtractionSchema = z.object({
  documentType: z.enum([
    'ECG_PDF',
    'AFIB_HISTORY_PDF',
    'MEDICATION_LIST',
    'ECHO_REPORT',
    'LAB_REPORT',
    'PRESCRIPTION',
    'OUTPATIENT_RECORD',
    'DISCHARGE_SUMMARY',
    'OTHER'
  ]),
  title: z.string(),
  summary: z.string(),
  facts: z.array(extractedFactSchema),
  warnings: z.array(z.string()).default([])
});
export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}
