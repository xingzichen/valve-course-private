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
  valueText: z.union([z.string(), z.number(), z.boolean()]).transform(String),
  valueNumeric: z
    .union([z.number(), z.string()])
    .transform((value) => (typeof value === 'number' ? value : Number(value)))
    .pipe(z.number().finite())
    .nullable()
    .optional(),
  unit: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
  referenceRange: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
  abnormalFlag: z
    .enum(['NORMAL', 'HIGH', 'LOW', 'ABNORMAL', 'CRITICAL', 'UNKNOWN'])
    .default('UNKNOWN'),
  factKind: z
    .enum([
      'MEASUREMENT',
      'DIAGNOSIS',
      'MEDICATION',
      'INSTRUCTION',
      'ECG_CLASSIFICATION',
      'METADATA',
      'OTHER'
    ])
    .default('OTHER'),
  pageNumber: z.coerce.number().int().positive().nullable().optional(),
  originalText: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
  confidence: z
    .union([z.number(), z.string()])
    .transform((value) => {
      const number = typeof value === 'number' ? value : Number(value);
      return number > 1 && number <= 100 ? number / 100 : number;
    })
    .pipe(z.number().min(0).max(1))
    .nullable()
    .optional(),
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
  documentedAt: z
    .string()
    .transform((value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+08:00` : value))
    .pipe(z.string().datetime({ offset: true }))
    .nullable()
    .default(null),
  datePrecision: z.enum(['DATETIME', 'DATE', 'UNKNOWN']).default('UNKNOWN'),
  facility: z.string().nullable().default(null),
  department: z.string().nullable().default(null),
  facts: z.array(extractedFactSchema),
  warnings: z.array(z.string()).default([])
});
export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;

export const documentAdviceSchema = z.object({
  overview: z.string(),
  keyFindings: z
    .array(
      z.object({
        label: z.string(),
        explanation: z.string(),
        evidenceFieldKeys: z.array(z.string()).default([])
      })
    )
    .default([]),
  followUpActions: z.array(z.string()).default([]),
  questionsForDoctor: z.array(z.string()).default([]),
  urgentWarning: z.string().nullable().default(null),
  limitations: z.array(z.string()).default([])
});
export type DocumentAdvice = z.infer<typeof documentAdviceSchema>;

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}
