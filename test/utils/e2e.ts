import { INestApplication } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/setup-app';

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
 * Boot the full app against the isolated test database with AUTH_DEV_MODE on.
 * Request wiring comes from the same configureApp() the real server uses, so a
 * change to main.ts's setup can't silently skip the suite. Returns the app, its
 * DataSource (so specs can truncate/inspect tables) and the generated OpenAPI
 * document.
 */
export async function createTestApp(): Promise<{
  app: INestApplication;
  dataSource: DataSource;
  document: OpenAPIObject;
}> {
  // Config (incl. DB_NAME=bloom_room_test) comes from .env.test, which the app
  // loads because jest sets NODE_ENV=test. We just make sure that DB exists first.
  await ensureTestDatabase();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  const document = configureApp(app);
  await app.init();

  return { app, dataSource: app.get(DataSource), document };
}
