import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { entities } from './entities';
import { InitialSchema1787833000000 } from './migrations/1787833000000-initial-schema';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ??
    'postgresql://valve_course:valve_course@localhost:5432/valve_course',
  entities,
  migrations: [InitialSchema1787833000000],
  synchronize: false,
  migrationsRun: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

export default AppDataSource;
