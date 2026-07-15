import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

const TEST_DB = process.env.TEST_DB_NAME ?? 'bloom_room_test';

function pgConn(database: string) {
  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'bloom',
    password: process.env.DB_PASSWORD ?? 'secret',
    database,
  };
}

/**
 * Create the throwaway test database if it doesn't exist yet. Uses a short-lived
 * DataSource against the `postgres` maintenance db so we don't need a separate
 * pg client (and its types) just for this.
 */
export async function ensureTestDatabase(): Promise<void> {
  const admin = new DataSource(pgConn('postgres'));
  await admin.initialize();
  try {
    const rows: unknown[] = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB],
    );
    if (rows.length === 0) {
      // CREATE DATABASE can't be parameterized or run in a transaction.
      await admin.query(`CREATE DATABASE ${TEST_DB}`);
    }
  } finally {
    await admin.destroy();
  }
}

/**
 * Boot the full app against the isolated test database with AUTH_DEV_MODE on,
 * mirroring main.ts's global ValidationPipe. Returns the app plus its DataSource
 * so specs can truncate/inspect tables.
 */
export async function createTestApp(): Promise<{
  app: INestApplication;
  dataSource: DataSource;
}> {
  // Config (incl. DB_NAME=bloom_room_test) comes from .env.test, which the app
  // loads because jest sets NODE_ENV=test. We just make sure that DB exists first.
  await ensureTestDatabase();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return { app, dataSource: app.get(DataSource) };
}
