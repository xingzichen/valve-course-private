import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { validateEnv, type AppEnv } from './config/env';
import { entities } from './database/entities';
import { HealthController } from './health.controller';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClinicalModule } from './modules/clinical/clinical.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL', { infer: true }),
        entities,
        synchronize: false,
        logging:
          config.get('NODE_ENV', { infer: true }) === 'development' ? ['error', 'warn'] : ['error']
      })
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        connection: { url: config.get('REDIS_URL', { infer: true }) }
      })
    }),
    AuditModule,
    AuthModule,
    ClinicalModule,
    DocumentsModule,
    AiModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
