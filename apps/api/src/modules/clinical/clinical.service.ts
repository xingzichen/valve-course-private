import { canCreateMedicationPlan, evaluateAnticoagulationOptions } from '@valve/clinical-rules';
import type { SourceType } from '@valve/contracts';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import {
  EcgRecordEntity,
  MedicalOrderEntity,
  MedicationEntity,
  MedicationEventEntity,
  MedicationPlanEntity,
  ObservationEntity,
  PatientProfileEntity,
  SourceEntity,
  TimelineEventEntity,
  VitalRecordEntity
} from '../../database/entities';

@Injectable()
export class ClinicalService {
  constructor(
    @InjectRepository(PatientProfileEntity)
    private readonly profiles: Repository<PatientProfileEntity>,
    @InjectRepository(SourceEntity) private readonly sources: Repository<SourceEntity>,
    @InjectRepository(TimelineEventEntity)
    private readonly timeline: Repository<TimelineEventEntity>,
    @InjectRepository(MedicalOrderEntity) private readonly orders: Repository<MedicalOrderEntity>,
    @InjectRepository(MedicationEntity) private readonly medications: Repository<MedicationEntity>,
    @InjectRepository(MedicationPlanEntity)
    private readonly medicationPlans: Repository<MedicationPlanEntity>,
    @InjectRepository(MedicationEventEntity)
    private readonly medicationEvents: Repository<MedicationEventEntity>,
    @InjectRepository(ObservationEntity)
    private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(VitalRecordEntity) private readonly vitals: Repository<VitalRecordEntity>,
    @InjectRepository(EcgRecordEntity) private readonly ecgs: Repository<EcgRecordEntity>,
    private readonly dataSource: DataSource
  ) {}

  async getProfile(): Promise<PatientProfileEntity> {
    const existing = await this.profiles.findOne({ where: { singletonKey: 'primary' } });
    return existing ?? this.profiles.save(this.profiles.create({ singletonKey: 'primary' }));
  }

  async updateProfile(input: Record<string, unknown>): Promise<PatientProfileEntity> {
    const profile = await this.getProfile();
    Object.assign(profile, this.numericStrings(input, ['heightCm', 'weightKg']));
    return this.profiles.save(profile);
  }

  async createSource(input: Record<string, unknown>): Promise<SourceEntity> {
    const isOfflineTreatingDoctor = input.sourceType === 'TREATING_DOCTOR_ORDER';
    const value = {
      ...input,
      publishedAt: input.publishedAt ? new Date(String(input.publishedAt)) : null,
      ...(isOfflineTreatingDoctor
        ? {
            platform: '线下就医',
            url: null,
            isPatientSpecific: true,
            originalQuote: null,
            metadata: {
              ...((input.metadata as Record<string, unknown> | undefined) ?? {}),
              channel: 'OFFLINE'
            }
          }
        : {})
    };
    return this.sources.save(this.sources.create(value));
  }

  listSources(limit: number, offset: number): Promise<SourceEntity[]> {
    return this.sources.find({
      where: { archivedAt: IsNull() },
      order: { capturedAt: 'DESC' },
      take: limit,
      skip: offset
    });
  }

  async createTimeline(input: Record<string, unknown>): Promise<TimelineEventEntity> {
    await this.requireOptionalSource(input.sourceId);
    return this.timeline.save(
      this.timeline.create({ ...input, occurredAt: new Date(String(input.occurredAt)) })
    );
  }

  listTimeline(limit: number, offset: number): Promise<TimelineEventEntity[]> {
    return this.timeline.find({
      where: { archivedAt: IsNull() },
      relations: { source: true },
      order: { occurredAt: 'DESC' },
      take: limit,
      skip: offset
    });
  }

  async createOrder(input: Record<string, unknown>): Promise<MedicalOrderEntity> {
    const source = await this.requireSource(String(input.sourceId));
    if (source.sourceType !== 'TREATING_DOCTOR_ORDER' || !source.isPatientSpecific) {
      throw new UnprocessableEntityException({
        code: 'ORDER_SOURCE_INVALID',
        message: '医嘱必须关联患者本人的线下就医来源；网络科普不能创建医嘱'
      });
    }
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MedicalOrderEntity);
      const order = repository.create({
        ...input,
        orderedAt: source.publishedAt ?? new Date(String(input.orderedAt)),
        doctorName: source.authorName,
        hospital: source.organization,
        department: source.specialty,
        options: Array.isArray(input.options) ? input.options : []
      });
      return repository.save(order);
    });
  }

  listOrders(limit: number, offset: number): Promise<MedicalOrderEntity[]> {
    return this.orders.find({
      where: { archivedAt: IsNull() },
      relations: { source: true, options: true },
      order: { orderedAt: 'DESC' },
      take: limit,
      skip: offset
    });
  }

  async recordOrderChoice(
    orderId: string,
    input: {
      selectedOptionId: string;
      choiceRationale: string;
      doctorConfirmed: boolean;
      doctorConfirmationNote?: string | null | undefined;
    }
  ): Promise<MedicalOrderEntity> {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: { source: true, options: true }
    });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: '医嘱不存在' });
    if (!order.options.some((option) => option.id === input.selectedOptionId)) {
      throw new UnprocessableEntityException({
        code: 'OPTION_NOT_IN_ORDER',
        message: '所选方案不属于该医嘱'
      });
    }
    order.selectedOptionId = input.selectedOptionId;
    order.choiceRationale = input.choiceRationale;
    order.selectedAt = new Date();
    order.doctorConfirmationNote = input.doctorConfirmationNote ?? null;
    order.status = input.doctorConfirmed ? 'ACTIVE' : 'PENDING_CONFIRMATION';
    return this.orders.save(order);
  }

  async createMedication(input: Record<string, unknown>): Promise<MedicationEntity> {
    await this.requireOptionalSource(input.sourceId);
    return this.medications.save(this.medications.create(input));
  }

  listMedications(): Promise<MedicationEntity[]> {
    return this.medications.find({
      where: { archivedAt: IsNull() },
      order: { genericName: 'ASC' }
    });
  }

  async createMedicationPlan(input: Record<string, unknown>): Promise<MedicationPlanEntity> {
    const [medication, order] = await Promise.all([
      this.medications.findOne({ where: { id: String(input.medicationId) } }),
      this.orders.findOne({
        where: { id: String(input.medicalOrderId) },
        relations: { source: true }
      })
    ]);
    if (!medication || !order)
      throw new NotFoundException({ code: 'REFERENCE_NOT_FOUND', message: '药品或医嘱不存在' });
    const confirmed = ['ACTIVE', 'COMPLETED'].includes(order.status);
    if (!canCreateMedicationPlan(order.source.sourceType as SourceType, confirmed)) {
      throw new UnprocessableEntityException({
        code: 'MEDICATION_PLAN_REQUIRES_CONFIRMED_ORDER',
        message: '只能根据已确认生效的经治医生医嘱建立服药计划'
      });
    }
    return this.medicationPlans.save(
      this.medicationPlans.create({ ...input, sourceId: order.sourceId })
    );
  }

  listMedicationPlans(): Promise<MedicationPlanEntity[]> {
    return this.medicationPlans.find({
      where: { archivedAt: IsNull() },
      relations: { medication: true, medicalOrder: true },
      order: { startDate: 'DESC' }
    });
  }

  async createMedicationEvent(
    planId: string,
    input: Record<string, unknown>
  ): Promise<MedicationEventEntity> {
    const plan = await this.medicationPlans.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: '服药计划不存在' });
    return this.medicationEvents.save(
      this.medicationEvents.create({
        ...input,
        medicationPlanId: planId,
        eventAt: new Date(String(input.eventAt))
      })
    );
  }

  async createObservation(input: Record<string, unknown>): Promise<ObservationEntity> {
    await this.requireOptionalSource(input.sourceId);
    const value = this.numericStrings(
      { ...input, observedAt: new Date(String(input.observedAt)) },
      ['valueNumeric']
    );
    return this.observations.save(this.observations.create(value));
  }

  listObservations(limit: number): Promise<ObservationEntity[]> {
    return this.observations.find({
      where: { archivedAt: IsNull() },
      order: { observedAt: 'DESC' },
      take: limit
    });
  }

  async createVital(input: Record<string, unknown>): Promise<VitalRecordEntity> {
    await this.requireOptionalSource(input.sourceId);
    const value = this.numericStrings(
      { ...input, observedAt: new Date(String(input.observedAt)) },
      ['valueNumeric']
    );
    return this.vitals.save(this.vitals.create(value));
  }

  listVitals(limit: number): Promise<VitalRecordEntity[]> {
    return this.vitals.find({
      where: { archivedAt: IsNull() },
      order: { observedAt: 'DESC' },
      take: limit
    });
  }

  async createEcg(input: Record<string, unknown>): Promise<EcgRecordEntity> {
    await this.requireOptionalSource(input.sourceId);
    if (input.healthkitUuid) {
      const duplicate = await this.ecgs.findOne({
        where: { healthkitUuid: String(input.healthkitUuid) }
      });
      if (duplicate)
        throw new ConflictException({
          code: 'ECG_DUPLICATE',
          message: '这条 Apple ECG 已经导入',
          id: duplicate.id
        });
    }
    const value = this.numericStrings(
      { ...input, recordedAt: new Date(String(input.recordedAt)) },
      ['averageHeartRate', 'samplingFrequency']
    );
    return this.ecgs.save(this.ecgs.create(value));
  }

  listEcgs(limit: number): Promise<EcgRecordEntity[]> {
    return this.ecgs.find({
      where: { archivedAt: IsNull() },
      order: { recordedAt: 'DESC' },
      take: limit
    });
  }

  async dashboard(): Promise<Record<string, unknown>> {
    const [profile, recentTimeline, activePlans, abnormalObservations, recentVitals, recentEcgs] =
      await Promise.all([
        this.getProfile(),
        this.timeline.find({
          where: { archivedAt: IsNull() },
          order: { occurredAt: 'DESC' },
          take: 6
        }),
        this.medicationPlans.find({
          where: { status: 'ACTIVE', archivedAt: IsNull() },
          relations: { medication: true },
          take: 20
        }),
        this.observations.find({
          where: { archivedAt: IsNull() },
          order: { observedAt: 'DESC' },
          take: 10
        }),
        this.vitals.find({
          where: { archivedAt: IsNull() },
          order: { observedAt: 'DESC' },
          take: 10
        }),
        this.ecgs.find({ where: { archivedAt: IsNull() }, order: { recordedAt: 'DESC' }, take: 5 })
      ]);
    return {
      profile,
      recentTimeline,
      activePlans,
      abnormalObservations: abnormalObservations.filter(
        (x) => x.abnormalFlag && x.abnormalFlag !== 'NORMAL'
      ),
      recentVitals,
      recentEcgs
    };
  }

  async decisionSupport(orderId: string, input: any): Promise<Record<string, unknown>> {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: { source: true, options: true }
    });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: '医嘱不存在' });
    const eligibility = evaluateAnticoagulationOptions({
      treatingDoctorOfferedOptions: order.options.length >= 2,
      ...input.clinicalFacts
    });
    const rivaroxaban = eligibility.find((item) => item.option === 'RIVAROXABAN');
    const missingPreferences = Object.entries(input.preferences)
      .filter(([, value]) => value === null)
      .map(([key]) => key);
    let suggestedDiscussionOption: 'WARFARIN' | 'RIVAROXABAN' | null = null;
    const rationale: string[] = [];
    if (eligibility.some((item) => item.status === 'UNKNOWN') || missingPreferences.length > 0) {
      rationale.push('关键临床事实或偏好尚未完整确认，因此不生成倾向性建议');
    } else if (rivaroxaban?.status === 'INELIGIBLE') {
      suggestedDiscussionOption = 'WARFARIN';
      rationale.push(...rivaroxaban.reasons, '便利性偏好不能越过医学适用性硬门槛');
    } else {
      let warfarinScore = 0;
      let rivaroxabanScore = 0;
      const p = input.preferences;
      if (p.canAttendRegularInrMonitoring) warfarinScore += 2;
      else rivaroxabanScore += 2;
      if (p.canKeepDietAndMedicationRoutineStable) warfarinScore += 1;
      else rivaroxabanScore += 1;
      if (p.acceptsDoseAdjustments) warfarinScore += 1;
      else rivaroxabanScore += 1;
      if (p.stronglyPrefersNoRoutineBloodTests) rivaroxabanScore += 2;
      if (p.adherenceConfidence === 'LOW')
        rationale.push('服药依从性信心较低，需要先与医生设计提醒和照护协助方案');
      if (p.primaryConcern === 'COST') rationale.push('费用偏好需要结合本地医保与长期监测成本核实');
      suggestedDiscussionOption = warfarinScore >= rivaroxabanScore ? 'WARFARIN' : 'RIVAROXABAN';
      rationale.push(`生活方式匹配分：华法林 ${warfarinScore}，利伐沙班 ${rivaroxabanScore}`);
    }
    return {
      scope: '仅用于复诊前共同决策准备，不是处方或换药指令',
      order: {
        id: order.id,
        originalText: order.originalText,
        source: order.source,
        options: order.options
      },
      eligibility,
      preferenceCompleteness: { missing: missingPreferences },
      suggestedDiscussionOption,
      rationale,
      nextAction: '将结果连同原始医嘱和待确认事项交给经治医生确认；未经确认不得启停或更换药物'
    };
  }

  private async requireSource(id: string): Promise<SourceEntity> {
    const source = await this.sources.findOne({ where: { id, archivedAt: IsNull() } });
    if (!source)
      throw new NotFoundException({ code: 'SOURCE_NOT_FOUND', message: '信息来源不存在' });
    return source;
  }

  private async requireOptionalSource(id: unknown): Promise<void> {
    if (id) await this.requireSource(String(id));
  }

  private numericStrings(input: Record<string, unknown>, keys: string[]): Record<string, unknown> {
    const result = { ...input };
    for (const key of keys) if (typeof result[key] === 'number') result[key] = String(result[key]);
    return result;
  }
}
