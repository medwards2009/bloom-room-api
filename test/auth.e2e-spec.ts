import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/e2e';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const login = (idToken: string, provider = 'google') =>
    request(app.getHttpServer()).post('/auth/login').send({ provider, idToken });

  const userCount = async (): Promise<number> => {
    const rows: Array<{ count: number }> = await dataSource.query(
      'SELECT count(*)::int AS count FROM users',
    );
    return rows[0].count;
  };

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('is public and reports the database up', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    });
  });

  describe('POST /auth/login', () => {
    it('creates a new user as a teacher and returns a token', async () => {
      const res = await login('dev-teacher-1').expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        userType: 'teacher',
        authProvider: 'google',
        authSubject: 'dev-teacher-1',
      });
      expect(await userCount()).toBe(1);
    });

    it('is idempotent for the same subject (find-or-create, no duplicate)', async () => {
      const first = await login('dev-teacher-1').expect(200);
      const second = await login('dev-teacher-1').expect(200);

      expect(second.body.user.id).toBe(first.body.user.id);
      expect(await userCount()).toBe(1);
    });

    it('creates distinct users for distinct subjects', async () => {
      const a = await login('dev-teacher-1').expect(200);
      const b = await login('dev-teacher-2').expect(200);

      expect(b.body.user.id).not.toBe(a.body.user.id);
      expect(await userCount()).toBe(2);
    });

    it('rejects a missing idToken with 400', () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ provider: 'google' })
        .expect(400));

    it('rejects an unknown provider with 400', () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ provider: 'myspace', idToken: 'x' })
        .expect(400));
  });

  describe('GET /me', () => {
    it('returns the current user with a valid token', async () => {
      const { body } = await login('dev-teacher-1').expect(200);

      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(body.user.id);
      expect(res.body.authSubject).toBe('dev-teacher-1');
    });

    it('rejects a request with no token', () =>
      request(app.getHttpServer()).get('/me').expect(401));

    it('rejects a request with a malformed token', () =>
      request(app.getHttpServer())
        .get('/me')
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401));
  });
});
