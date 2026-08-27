import {
  dataNatureSchema,
  orderStatusSchema,
  sourceTypeSchema,
  verificationStatusSchema
} from '@valve/contracts';
import { z } from 'zod';

const nullableText = (max = 10_000) => z.string().trim().max(max).nullable().optional();
const isoDateTime = z.string().datetime({ offset: true });

export const profileSchema = z.object({
  fullName: nullableText(120),
  birthDate: z.string().date().nullable().optional(),
  sex: nullableText(32),
  bloodType: nullableText(16),
  heightCm: z.coerce.number().positive().max(260).nullable().optional(),
  weightKg: z.coerce.number().positive().max(500).nullable().optional(),
  allergies: nullableText(),
  diagnosisSummary: nullableText(),
  mitralStenosisCause: nullableText(80),
  mitralStenosisSeverity: nullableText(80),
  atrialFibrillationStatus: nullableText(40),
  anticoagulationSummary: nullableText(),
  emergencyContact: z.record(z.string(), z.unknown()).optional(),
  preferences: z.record(z.string(), z.unknown()).optional()
});

export const sourceSchema = z
  .object({
    sourceType: sourceTypeSchema,
    title: z.string().trim().min(1).max(300),
    authorName: nullableText(160),
    organization: nullableText(200),
    specialty: nullableText(120),
    platform: nullableText(120),
    url: z.string().url().nullable().optional(),
    publishedAt: isoDateTime.nullable().optional(),
    isPatientSpecific: z.boolean().default(false),
    dataNature: dataNatureSchema.nullable().optional(),
    originalQuote: nullableText(30_000),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .superRefine((value, context) => {
    if (value.sourceType === 'TREATING_DOCTOR_ORDER' && !value.isPatientSpecific) {
      context.addIssue({
        code: 'custom',
        path: ['isPatientSpecific'],
        message: '经治医生医嘱必须标记为针对患者本人'
      });
    }
  });

export const timelineSchema = z.object({
  eventType: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(300),
  description: nullableText(30_000),
  occurredAt: isoDateTime,
  sourceId: z.string().uuid().nullable().optional(),
  verificationStatus: verificationStatusSchema.default('CONFIRMED'),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const orderOptionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  medicationName: nullableText(200),
  instructions: nullableText(),
  conditions: nullableText(),
  risks: nullableText(),
  monitoring: nullableText()
});

export const orderSchema = z.object({
  orderedAt: isoDateTime,
  doctorName: nullableText(120),
  hospital: nullableText(200),
  department: nullableText(120),
  originalText: z.string().trim().min(1).max(50_000),
  purpose: nullableText(),
  status: orderStatusSchema.default('PENDING_CONFIRMATION'),
  sourceId: z.string().uuid(),
  options: z.array(orderOptionSchema).max(20).default([])
});

export const medicationSchema = z.object({
  genericName: z.string().trim().min(1).max(200),
  brandName: nullableText(200),
  dosageForm: nullableText(120),
  sourceId: z.string().uuid().nullable().optional()
});

export const orderChoiceSchema = z.object({
  selectedOptionId: z.string().uuid(),
  choiceRationale: z.string().trim().min(1).max(20_000),
  doctorConfirmed: z.boolean().default(false),
  doctorConfirmationNote: nullableText(10_000)
});

export const medicationPlanSchema = z.object({
  medicationId: z.string().uuid(),
  medicalOrderId: z.string().uuid(),
  dose: z.string().trim().min(1).max(120),
  frequency: z.string().trim().min(1).max(120),
  startDate: z.string().date(),
  endDate: z.string().date().nullable().optional()
});

export const medicationEventSchema = z.object({
  eventType: z.enum(['TAKEN', 'MISSED', 'SKIPPED_BY_DOCTOR', 'ADVERSE_EFFECT', 'NOTE']),
  eventAt: isoDateTime,
  notes: nullableText()
});

export const observationSchema = z
  .object({
    nameOriginal: z.string().trim().min(1).max(240),
    nameNormalized: z.string().trim().min(1).max(240),
    valueNumeric: z.coerce.number().nullable().optional(),
    valueText: nullableText(),
    unitOriginal: nullableText(80),
    referenceText: nullableText(200),
    abnormalFlag: z.enum(['LOW', 'HIGH', 'ABNORMAL', 'NORMAL']).nullable().optional(),
    observedAt: isoDateTime,
    sourceId: z.string().uuid().nullable().optional(),
    verificationStatus: verificationStatusSchema.default('CONFIRMED')
  })
  .refine((value) => value.valueNumeric != null || Boolean(value.valueText), {
    message: '数值或文本结果至少填写一项'
  });

export const vitalSchema = z.object({
  vitalType: z.enum([
    'HEART_RATE',
    'BLOOD_PRESSURE_SYSTOLIC',
    'BLOOD_PRESSURE_DIASTOLIC',
    'WEIGHT',
    'SPO2',
    'TEMPERATURE',
    'INR',
    'OTHER'
  ]),
  valueNumeric: z.coerce.number().finite(),
  unit: z.string().trim().min(1).max(40),
  observedAt: isoDateTime,
  sourceId: z.string().uuid().nullable().optional(),
  notes: nullableText()
});

export const ecgSchema = z.object({
  healthkitUuid: z.string().uuid().nullable().optional(),
  recordedAt: isoDateTime,
  sourceFormat: z.enum(['APPLE_ECG_PDF', 'HEALTHKIT_XML', 'CSV', 'MANUAL']),
  classificationOriginal: nullableText(80),
  averageHeartRate: z.coerce.number().positive().max(400).nullable().optional(),
  symptomsStatus: nullableText(80),
  samplingFrequency: z.coerce.number().positive().nullable().optional(),
  sampleCount: z.coerce.number().int().positive().nullable().optional(),
  appleAlgorithmVersion: nullableText(80),
  documentId: z.string().uuid().nullable().optional(),
  sourceId: z.string().uuid().nullable().optional(),
  userNotes: nullableText()
});

export const decisionSupportSchema = z.object({
  clinicalFacts: z.object({
    rheumaticMitralStenosis: z.boolean().nullable(),
    moderateOrSevereMitralStenosis: z.boolean().nullable(),
    atrialFibrillation: z.boolean().nullable(),
    mechanicalValve: z.boolean().nullable()
  }),
  preferences: z.object({
    canAttendRegularInrMonitoring: z.boolean().nullable(),
    canKeepDietAndMedicationRoutineStable: z.boolean().nullable(),
    acceptsDoseAdjustments: z.boolean().nullable(),
    stronglyPrefersNoRoutineBloodTests: z.boolean().nullable(),
    adherenceConfidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
    primaryConcern: z.enum(['SAFETY', 'CONVENIENCE', 'COST', 'UNCERTAIN']).nullable()
  })
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});
