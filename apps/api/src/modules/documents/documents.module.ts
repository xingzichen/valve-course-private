import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  DocumentEntity,
  ExtractedFactEntity,
  ExtractionRunEntity,
  SourceEntity
} from '../../database/entities';
import { AuditModule } from '../audit/audit.module';
import { OmlxModule } from '../omlx/omlx.module';
import { DOCUMENT_QUEUE } from './documents.constants';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentEntity,
      ExtractionRunEntity,
      ExtractedFactEntity,
      SourceEntity
    ]),
    BullModule.registerQueue({ name: DOCUMENT_QUEUE }),
    AuditModule,
    OmlxModule
  ],
  providers: [DocumentsService],
  controllers: [DocumentsController],
  exports: [DocumentsService]
})
export class DocumentsModule {}
