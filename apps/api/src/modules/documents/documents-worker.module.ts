import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DocumentEntity, ExtractedFactEntity, ExtractionRunEntity } from '../../database/entities';
import { OmlxModule } from '../omlx/omlx.module';
import { DocumentProcessor } from './document.processor';
import { DOCUMENT_QUEUE } from './documents.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, ExtractionRunEntity, ExtractedFactEntity]),
    BullModule.registerQueue({ name: DOCUMENT_QUEUE }),
    OmlxModule
  ],
  providers: [DocumentProcessor]
})
export class DocumentsWorkerModule {}
