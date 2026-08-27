import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiAnalysisEntity } from '../../database/entities';
import { AuditModule } from '../audit/audit.module';
import { OmlxModule } from '../omlx/omlx.module';
import { AI_QUEUE } from './ai.constants';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiAnalysisEntity]),
    BullModule.registerQueue({ name: AI_QUEUE }),
    AuditModule,
    OmlxModule
  ],
  providers: [AiService],
  controllers: [AiController]
})
export class AiModule {}
