import 'reflect-metadata';

import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { assignRequestId } from './common/http';
import type { AppEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({ trustProxy: true, bodyLimit: 2 * 1024 * 1024 });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  const config = app.get(ConfigService<AppEnv, true>);

  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(multipart, {
    limits: { fileSize: config.get('MAX_UPLOAD_BYTES', { infer: true }), files: 1, fields: 20 }
  });
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, reply, done) => {
      assignRequestId(request, reply);
      done();
    });
  app.enableCors({
    origin: config.get('APP_BASE_URL', { infer: true }),
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-ID']
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiExceptionFilter());

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('Valve Course Private API')
      .setDescription('私人病程管理 API；任何分析结果都不构成自动医嘱。')
      .setVersion('0.1.0')
      .addCookieAuth('valve_session')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
  }

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on ${port}`, 'Bootstrap');
}

void bootstrap();
