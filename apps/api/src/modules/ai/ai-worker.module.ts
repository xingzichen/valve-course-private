import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  AiAnalysisEntity,
  EcgRecordEntity,
  ExtractedFactEntity,
  MedicalOrderEntity,
  MedicationPlanEntity,
  ObservationEntity,
  PatientProfileEntity,
  SourceEntity,
  TimelineEventEntity,
  VitalRecordEntity
} from '../../database/entities';
import { OmlxModule } from '../omlx/omlx.module';
import { AI_QUEUE } from './ai.constants';
import { AiProcessor } from './ai.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiAnalysisEntity,
      PatientProfileEntity,
      SourceEntity,
      TimelineEventEntity,
      MedicalOrderEntity,
      MedicationPlanEntity,
      ObservationEntity,
      VitalRecordEntity,
      EcgRecordEntity,
      ExtractedFactEntity
    ]),
    BullModule.registerQueue({ name: AI_QUEUE }),
    OmlxModule
  ],
  providers: [AiProcessor]
})
export class AiWorkerModule {}
