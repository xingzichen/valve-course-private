import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { entities } from './entities';
import { InitialSchema1787833000000 } from './migrations/1787833000000-initial-schema';
import { AutomaticDocumentIntelligence1787925600000 } from './migrations/1787925600000-automatic-document-intelligence';
import { ReportDateTimelineOnly1787929200000 } from './migrations/1787929200000-report-date-timeline-only';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ??
    'postgresql://valve_course:valve_course@localhost:5432/valve_course',
  entities,
  migrations: [
    InitialSchema1787833000000,
    AutomaticDocumentIntelligence1787925600000,
    ReportDateTimelineOnly1787929200000
  ],
  synchronize: false,
  migrationsRun: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

export default AppDataSource;
