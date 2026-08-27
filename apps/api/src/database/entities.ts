import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn
} from 'typeorm';

export abstract class BaseRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn({ default: 1 })
  version: number;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;
}

@Entity({ name: 'users' })
export class UserEntity extends BaseRecord {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  username: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120, default: '家庭管理员' })
  displayName: string;

  @Column({ name: 'password_changed_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  passwordChangedAt: Date;

  @OneToMany(() => SessionEntity, (session) => session.user)
  sessions: SessionEntity[];
}

@Entity({ name: 'sessions' })
export class SessionEntity extends BaseRecord {
  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ name: 'csrf_token', type: 'varchar', length: 128 })
  csrfToken: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastSeenAt: Date;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;
}

@Entity({ name: 'patient_profiles' })
export class PatientProfileEntity extends BaseRecord {
  @Index({ unique: true })
  @Column({ name: 'singleton_key', type: 'varchar', length: 32, default: 'primary' })
  singletonKey: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120, nullable: true })
  fullName: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  sex: string | null;

  @Column({ name: 'blood_type', type: 'varchar', length: 16, nullable: true })
  bloodType: string | null;

  @Column({ name: 'height_cm', type: 'numeric', precision: 6, scale: 2, nullable: true })
  heightCm: string | null;

  @Column({ name: 'weight_kg', type: 'numeric', precision: 6, scale: 2, nullable: true })
  weightKg: string | null;

  @Column({ type: 'text', nullable: true })
  allergies: string | null;

  @Column({ name: 'diagnosis_summary', type: 'text', nullable: true })
  diagnosisSummary: string | null;

  @Column({ name: 'mitral_stenosis_cause', type: 'varchar', length: 80, nullable: true })
  mitralStenosisCause: string | null;

  @Column({ name: 'mitral_stenosis_severity', type: 'varchar', length: 80, nullable: true })
  mitralStenosisSeverity: string | null;

  @Column({ name: 'atrial_fibrillation_status', type: 'varchar', length: 40, nullable: true })
  atrialFibrillationStatus: string | null;

  @Column({ name: 'anticoagulation_summary', type: 'text', nullable: true })
  anticoagulationSummary: string | null;

  @Column({ name: 'emergency_contact', type: 'jsonb', default: () => "'{}'::jsonb" })
  emergencyContact: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  preferences: Record<string, unknown>;
}

@Entity({ name: 'sources' })
export class SourceEntity extends BaseRecord {
  @Index()
  @Column({ name: 'source_type', type: 'varchar', length: 64 })
  sourceType: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ name: 'author_name', type: 'varchar', length: 160, nullable: true })
  authorName: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  organization: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  specialty: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  platform: string | null;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'captured_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  capturedAt: Date;

  @Column({ name: 'is_patient_specific', type: 'boolean', default: false })
  isPatientSpecific: boolean;

  @Column({ name: 'data_nature', type: 'varchar', length: 40, nullable: true })
  dataNature: string | null;

  @Column({ name: 'original_quote', type: 'text', nullable: true })
  originalQuote: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;
}

@Entity({ name: 'timeline_events' })
@Index(['occurredAt'])
export class TimelineEventEntity extends BaseRecord {
  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  @ManyToOne(() => SourceEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_id' })
  source: SourceEntity | null;

  @Column({ name: 'verification_status', type: 'varchar', length: 32, default: 'CONFIRMED' })
  verificationStatus: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;
}

@Entity({ name: 'medical_orders' })
@Index(['status', 'orderedAt'])
export class MedicalOrderEntity extends BaseRecord {
  @Column({ name: 'ordered_at', type: 'timestamptz' })
  orderedAt: Date;

  @Column({ name: 'doctor_name', type: 'varchar', length: 120, nullable: true })
  doctorName: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  hospital: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  @Column({ name: 'original_text', type: 'text' })
  originalText: string;

  @Column({ type: 'text', nullable: true })
  purpose: string | null;

  @Column({ type: 'varchar', length: 40, default: 'PENDING_CONFIRMATION' })
  status: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({ name: 'selected_option_id', type: 'uuid', nullable: true })
  selectedOptionId: string | null;

  @Column({ name: 'choice_rationale', type: 'text', nullable: true })
  choiceRationale: string | null;

  @Column({ name: 'doctor_confirmation_note', type: 'text', nullable: true })
  doctorConfirmationNote: string | null;

  @Column({ name: 'selected_at', type: 'timestamptz', nullable: true })
  selectedAt: Date | null;

  @ManyToOne(() => SourceEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_id' })
  source: SourceEntity;

  @OneToMany(() => OrderOptionEntity, (option) => option.order, { cascade: true })
  options: OrderOptionEntity[];
}

@Entity({ name: 'order_options' })
export class OrderOptionEntity extends BaseRecord {
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => MedicalOrderEntity, (order) => order.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: MedicalOrderEntity;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'medication_name', type: 'varchar', length: 200, nullable: true })
  medicationName: string | null;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ type: 'text', nullable: true })
  conditions: string | null;

  @Column({ type: 'text', nullable: true })
  risks: string | null;

  @Column({ type: 'text', nullable: true })
  monitoring: string | null;
}

@Entity({ name: 'medications' })
export class MedicationEntity extends BaseRecord {
  @Index()
  @Column({ name: 'generic_name', type: 'varchar', length: 200 })
  genericName: string;

  @Column({ name: 'brand_name', type: 'varchar', length: 200, nullable: true })
  brandName: string | null;

  @Column({ name: 'dosage_form', type: 'varchar', length: 120, nullable: true })
  dosageForm: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;
}

@Entity({ name: 'medication_plans' })
export class MedicationPlanEntity extends BaseRecord {
  @Column({ name: 'medication_id', type: 'uuid' })
  medicationId: string;

  @ManyToOne(() => MedicationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'medication_id' })
  medication: MedicationEntity;

  @Column({ name: 'medical_order_id', type: 'uuid' })
  medicalOrderId: string;

  @ManyToOne(() => MedicalOrderEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'medical_order_id' })
  medicalOrder: MedicalOrderEntity;

  @Column({ type: 'varchar', length: 120 })
  dose: string;

  @Column({ type: 'varchar', length: 120 })
  frequency: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'varchar', length: 32, default: 'ACTIVE' })
  status: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;
}

@Entity({ name: 'medication_events' })
export class MedicationEventEntity extends BaseRecord {
  @Column({ name: 'medication_plan_id', type: 'uuid' })
  medicationPlanId: string;

  @ManyToOne(() => MedicationPlanEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medication_plan_id' })
  medicationPlan: MedicationPlanEntity;

  @Column({ name: 'event_type', type: 'varchar', length: 40 })
  eventType: string;

  @Column({ name: 'event_at', type: 'timestamptz' })
  eventAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}

@Entity({ name: 'documents' })
export class DocumentEntity extends BaseRecord {
  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  sha256: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 500 })
  originalFilename: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: string;

  @Column({ name: 'storage_path', type: 'text' })
  storagePath: string;

  @Column({ name: 'document_type', type: 'varchar', length: 64, default: 'OTHER' })
  documentType: string;

  @Index()
  @Column({ type: 'varchar', length: 40, default: 'UPLOADED' })
  status: string;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;
}

@Entity({ name: 'extraction_runs' })
export class ExtractionRunEntity extends BaseRecord {
  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @ManyToOne(() => DocumentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: DocumentEntity;

  @Column({ type: 'varchar', length: 40, default: 'QUEUED' })
  status: string;

  @Column({ name: 'model_id', type: 'varchar', length: 200 })
  modelId: string;

  @Column({ name: 'prompt_version', type: 'varchar', length: 80 })
  promptVersion: string;

  @Column({ name: 'raw_output', type: 'jsonb', nullable: true })
  rawOutput: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}

@Entity({ name: 'extracted_facts' })
export class ExtractedFactEntity extends BaseRecord {
  @Column({ name: 'extraction_run_id', type: 'uuid' })
  extractionRunId: string;

  @ManyToOne(() => ExtractionRunEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'extraction_run_id' })
  extractionRun: ExtractionRunEntity;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ name: 'field_key', type: 'varchar', length: 160 })
  fieldKey: string;

  @Column({ type: 'varchar', length: 240 })
  label: string;

  @Column({ name: 'value_text', type: 'text' })
  valueText: string;

  @Column({ name: 'value_numeric', type: 'numeric', nullable: true })
  valueNumeric: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  unit: string | null;

  @Column({ name: 'page_number', type: 'integer', nullable: true })
  pageNumber: number | null;

  @Column({ name: 'original_text', type: 'text', nullable: true })
  originalText: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidence: string | null;

  @Column({ name: 'high_risk', type: 'boolean', default: false })
  highRisk: boolean;

  @Column({ name: 'verification_status', type: 'varchar', length: 32, default: 'PENDING' })
  verificationStatus: string;
}

@Entity({ name: 'observations' })
@Index(['nameNormalized', 'observedAt'])
export class ObservationEntity extends BaseRecord {
  @Column({ name: 'name_original', type: 'varchar', length: 240 })
  nameOriginal: string;

  @Column({ name: 'name_normalized', type: 'varchar', length: 240 })
  nameNormalized: string;

  @Column({ name: 'value_numeric', type: 'numeric', nullable: true })
  valueNumeric: string | null;

  @Column({ name: 'value_text', type: 'text', nullable: true })
  valueText: string | null;

  @Column({ name: 'unit_original', type: 'varchar', length: 80, nullable: true })
  unitOriginal: string | null;

  @Column({ name: 'reference_text', type: 'varchar', length: 200, nullable: true })
  referenceText: string | null;

  @Column({ name: 'abnormal_flag', type: 'varchar', length: 32, nullable: true })
  abnormalFlag: string | null;

  @Column({ name: 'observed_at', type: 'timestamptz' })
  observedAt: Date;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  @Column({ name: 'verification_status', type: 'varchar', length: 32, default: 'CONFIRMED' })
  verificationStatus: string;
}

@Entity({ name: 'vital_records' })
@Index(['vitalType', 'observedAt'])
export class VitalRecordEntity extends BaseRecord {
  @Column({ name: 'vital_type', type: 'varchar', length: 80 })
  vitalType: string;

  @Column({ name: 'value_numeric', type: 'numeric' })
  valueNumeric: string;

  @Column({ type: 'varchar', length: 40 })
  unit: string;

  @Column({ name: 'observed_at', type: 'timestamptz' })
  observedAt: Date;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}

@Entity({ name: 'ecg_records' })
@Index(['recordedAt'])
export class EcgRecordEntity extends BaseRecord {
  @Index({ unique: true, where: 'healthkit_uuid IS NOT NULL' })
  @Column({ name: 'healthkit_uuid', type: 'uuid', nullable: true })
  healthkitUuid: string | null;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  @Column({ name: 'source_format', type: 'varchar', length: 40 })
  sourceFormat: string;

  @Column({ name: 'classification_original', type: 'varchar', length: 80, nullable: true })
  classificationOriginal: string | null;

  @Column({ name: 'average_heart_rate', type: 'numeric', nullable: true })
  averageHeartRate: string | null;

  @Column({ name: 'symptoms_status', type: 'varchar', length: 80, nullable: true })
  symptomsStatus: string | null;

  @Column({ name: 'sampling_frequency', type: 'numeric', nullable: true })
  samplingFrequency: string | null;

  @Column({ name: 'sample_count', type: 'integer', nullable: true })
  sampleCount: number | null;

  @Column({ name: 'apple_algorithm_version', type: 'varchar', length: 80, nullable: true })
  appleAlgorithmVersion: string | null;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId: string | null;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  @Column({ name: 'user_notes', type: 'text', nullable: true })
  userNotes: string | null;

  @Column({ name: 'clinician_interpretation', type: 'text', nullable: true })
  clinicianInterpretation: string | null;
}

@Entity({ name: 'ai_analyses' })
export class AiAnalysisEntity extends BaseRecord {
  @Column({ name: 'analysis_type', type: 'varchar', length: 64 })
  analysisType: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'varchar', length: 40, default: 'QUEUED' })
  status: string;

  @Column({ name: 'model_id', type: 'varchar', length: 200 })
  modelId: string;

  @Column({ name: 'prompt_version', type: 'varchar', length: 80 })
  promptVersion: string;

  @Column({ type: 'text', nullable: true })
  answer: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  citations: Array<Record<string, unknown>>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}

@Entity({ name: 'audit_events' })
@Index(['createdAt'])
export class AuditEventEntity extends BaseRecord {
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 120 })
  action: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 120 })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;
}

export const entities = [
  UserEntity,
  SessionEntity,
  PatientProfileEntity,
  SourceEntity,
  TimelineEventEntity,
  MedicalOrderEntity,
  OrderOptionEntity,
  MedicationEntity,
  MedicationPlanEntity,
  MedicationEventEntity,
  DocumentEntity,
  ExtractionRunEntity,
  ExtractedFactEntity,
  ObservationEntity,
  VitalRecordEntity,
  EcgRecordEntity,
  AiAnalysisEntity,
  AuditEventEntity
];
