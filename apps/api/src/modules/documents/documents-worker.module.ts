import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  DocumentEntity,
  ExtractedFactEntity,
  ExtractionRunEntity,
  MedicalOrderEntity,
  MedicationPlanEntity,
  PatientProfileEntity,
  SourceEntity,
  TimelineEventEntity
} from '../../database/entities';
import { OmlxModule } from '../omlx/omlx.module';
import { DocumentProcessor } from './document.processor';
import { DocumentRecoveryService } from './document-recovery.service';
import { DOCUMENT_QUEUE } from './documents.constants';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentEntity,
      ExtractionRunEntity,
      ExtractedFactEntity,
      SourceEntity,
      TimelineEventEntity,
      PatientProfileEntity,
      MedicalOrderEntity,
      MedicationPlanEntity
    ]),
    BullModule.registerQueue({ name: DOCUMENT_QUEUE }),
    OmlxModule
  ],
  providers: [DocumentProcessor, DocumentsService, DocumentRecoveryService]
})
export class DocumentsWorkerModule {}
