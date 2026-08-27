import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CurrentUser, type CurrentUserValue } from '../../common/current-user.decorator';
import { parseWithSchema } from '../../common/zod';
import { AuditService } from '../audit/audit.service';
import { ClinicalService } from './clinical.service';
import {
  decisionSupportSchema,
  ecgSchema,
  listQuerySchema,
  medicationEventSchema,
  medicationPlanSchema,
  medicationSchema,
  observationSchema,
  orderChoiceSchema,
  orderSchema,
  profileSchema,
  sourceSchema,
  timelineSchema,
  vitalSchema
} from './clinical.schemas';

@ApiTags('clinical')
@Controller()
export class ClinicalController {
  constructor(
    private readonly clinical: ClinicalService,
    private readonly audit: AuditService
  ) {}

  @Get('dashboard') dashboard() {
    return this.clinical.dashboard();
  }
  @Get('profile') profile() {
    return this.clinical.getProfile();
  }

  @Patch('profile')
  async updateProfile(@Body() body: unknown, @CurrentUser() user: CurrentUserValue) {
    const result = await this.clinical.updateProfile(parseWithSchema(profileSchema, body));
    await this.changed(user, 'PROFILE_UPDATE', 'PatientProfile', result.id);
    return result;
  }

  @Get('sources') listSources(@Query() query: unknown) {
    const { limit, offset } = parseWithSchema(listQuerySchema, query);
    return this.clinical.listSources(limit, offset);
  }

  @Post('sources')
  async createSource(@Body() body: unknown, @CurrentUser() user: CurrentUserValue) {
    const result = await this.clinical.createSource(parseWithSchema(sourceSchema, body));
    await this.changed(user, 'SOURCE_CREATE', 'Source', result.id, {
      sourceType: result.sourceType
    });
    return result;
  }

  @Get('timeline') listTimeline(@Query() query: unknown) {
    const { limit, offset } = parseWithSchema(listQuerySchema, query);
    return this.clinical.listTimeline(limit, offset);
  }

  @Post('timeline')
  async createTimeline(@Body() body: unknown, @CurrentUser() user: CurrentUserValue) {
    const result = await this.clinical.createTimeline(parseWithSchema(timelineSchema, body));
    await this.changed(user, 'TIMELINE_CREATE', 'TimelineEvent', result.id);
    return result;
  }

  @Get('orders') listOrders(@Query() query: unknown) {
    const { limit, offset } = parseWithSchema(listQuerySchema, query);
    return this.clinical.listOrders(limit, offset);
  }

  @Post('orders')
  async createOrder(@Body() body: unknown, @CurrentUser() user: CurrentUserValue) {
    const result = await this.clinical.createOrder(parseWithSchema(orderSchema, body));
    await this.changed(user, 'ORDER_CREATE', 'MedicalOrder', result.id);
    return result;
  }

  @Post('orders/:id/decision-support')
  async decisionSupport(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserValue
  ) {
    const result = await this.clinical.decisionSupport(
      id,
      parseWithSchema(decisionSupportSchema, body)
    );
    await this.changed(user, 'DECISION_SUPPORT_RUN', 'MedicalOrder', id);
    return result;
  }

  @Post('orders/:id/choice')
  async recordChoice(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserValue
  ) {
    const result = await this.clinical.recordOrderChoice(
      id,
      parseWithSchema(orderChoiceSchema, body)
    );
    await this.changed(user, 'ORDER_CHOICE_RECORDED', 'MedicalOrder', id, {
      selectedOptionId: result.selectedOptionId,
      status: result.status
    });
    return result;
  }

  @Get('medications') listMedications() {
    return this.clinical.listMedications();
  }
  @Post('medications') async createMedication(
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserValue
  ) {
    const result = await this.clinical.createMedication(parseWithSchema(medicationSchema, body));
    await this.changed(user, 'MEDICATION_CREATE', 'Medication', result.id);
    return result;
  }

  @Get('medication-plans') listMedicationPlans() {
    return this.clinical.listMedicationPlans();
  }
  @Post('medication-plans') async createMedicationPlan(
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserValue
  ) {
    const result = await this.clinical.createMedicationPlan(
      parseWithSchema(medicationPlanSchema, body)
    );
    await this.changed(user, 'MEDICATION_PLAN_CREATE', 'MedicationPlan', result.id);
    return result;
  }

  @Post('medication-plans/:id/events') async createMedicationEvent(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserValue
  ) {
    const result = await this.clinical.createMedicationEvent(
      id,
      parseWithSchema(medicationEventSchema, body)
    );
    await this.changed(user, 'MEDICATION_EVENT_CREATE', 'MedicationEvent', result.id);
    return result;
  }

  @Get('observations') async listObservations(@Query() query: unknown) {
    return this.clinical.listObservations(parseWithSchema(listQuerySchema, query).limit);
  }
  @Post('observations') async createObservation(
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserValue
  ) {
    const result = await this.clinical.createObservation(parseWithSchema(observationSchema, body));
    await this.changed(user, 'OBSERVATION_CREATE', 'Observation', result.id);
    return result;
  }

  @Get('vitals') async listVitals(@Query() query: unknown) {
    return this.clinical.listVitals(parseWithSchema(listQuerySchema, query).limit);
  }
  @Post('vitals') async createVital(@Body() body: unknown, @CurrentUser() user: CurrentUserValue) {
    const result = await this.clinical.createVital(parseWithSchema(vitalSchema, body));
    await this.changed(user, 'VITAL_CREATE', 'VitalRecord', result.id);
    return result;
  }

  @Get('ecg') async listEcgs(@Query() query: unknown) {
    return this.clinical.listEcgs(parseWithSchema(listQuerySchema, query).limit);
  }
  @Post('ecg') async createEcg(@Body() body: unknown, @CurrentUser() user: CurrentUserValue) {
    const result = await this.clinical.createEcg(parseWithSchema(ecgSchema, body));
    await this.changed(user, 'ECG_CREATE', 'EcgRecord', result.id);
    return result;
  }

  private changed(
    user: CurrentUserValue,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, unknown>
  ) {
    return this.audit.record({
      actorUserId: user.id,
      action,
      resourceType,
      resourceId,
      ...(metadata ? { metadata } : {})
    });
  }
}
