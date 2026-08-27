import 'reflect-metadata';

import AppDataSource from './data-source';

async function migrate(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const completed = await AppDataSource.runMigrations({ transaction: 'all' });
    console.log(`Database migrations complete (${completed.length} applied)`);
  } finally {
    await AppDataSource.destroy();
  }
}

void migrate();
