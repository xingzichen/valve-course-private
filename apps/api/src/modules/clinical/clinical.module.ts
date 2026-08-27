import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  EcgRecordEntity,
  MedicalOrderEntity,
  MedicationEntity,
  MedicationEventEntity,
  MedicationPlanEntity,
  ObservationEntity,
  OrderOptionEntity,
  PatientProfileEntity,
  SourceEntity,
  TimelineEventEntity,
  VitalRecordEntity
} from '../../database/entities';
import { AuditModule } from '../audit/audit.module';
import { ClinicalController } from './clinical.controller';
import { ClinicalService } from './clinical.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientProfileEntity,
      SourceEntity,
      TimelineEventEntity,
      MedicalOrderEntity,
      OrderOptionEntity,
      MedicationEntity,
      MedicationPlanEntity,
      MedicationEventEntity,
      ObservationEntity,
      VitalRecordEntity,
      EcgRecordEntity
    ]),
    AuditModule
  ],
  controllers: [ClinicalController],
  providers: [ClinicalService],
  exports: [ClinicalService]
})
export class ClinicalModule {}
