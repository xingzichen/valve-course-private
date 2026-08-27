import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { WorkerAppModule } from './worker-app.module';

async function bootstrap(): Promise<void> {
  await NestFactory.createApplicationContext(WorkerAppModule);
  Logger.log('Document and AI workers are running', 'Worker');
}

void bootstrap();
