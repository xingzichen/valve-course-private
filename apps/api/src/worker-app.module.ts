import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { validateEnv, type AppEnv } from './config/env';
import { entities } from './database/entities';
import { AiWorkerModule } from './modules/ai/ai-worker.module';
import { DocumentsWorkerModule } from './modules/documents/documents-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL', { infer: true }),
        entities,
        synchronize: false
      })
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        connection: { url: config.get('REDIS_URL', { infer: true }) }
      })
    }),
    DocumentsWorkerModule,
    AiWorkerModule
  ]
})
export class WorkerAppModule {}
