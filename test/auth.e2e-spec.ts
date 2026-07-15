import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/e2e';

/** The JSON shape AuthService returns for a user (dates serialize to strings). */
interface UserBody {
  id: string;
  userType: string;
  authProvider: string;
  authSubject: string;
  firstName: string;
  lastName: string;
}

interface LoginBody {
  accessToken: string;
  user: UserBody;
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // getHttpServer() is typed `any`; narrow it once here rather than at each call.
  const server = () => app.getHttpServer() as App;

  const login = (idToken: string, provider = 'google') =>
    request(server()).post('/auth/login').send({ provider, idToken });

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
      const res = await request(server()).get('/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    });
  });

  describe('POST /auth/login', () => {
    it('creates a new user as a teacher and returns a token', async () => {
      const res = await login('dev-teacher-1').expect(200);
      const body = res.body as LoginBody;

      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user).toMatchObject({
        userType: 'teacher',
        authProvider: 'google',
        authSubject: 'dev-teacher-1',
        firstName: 'Dev',
        lastName: 'dev-teacher-1',
      });
      expect(await userCount()).toBe(1);
    });

    it('captures a name from the dev token override "subject|First|Last"', async () => {
      const res = await login('dev-teacher-1|Jane|Doe').expect(200);
      expect((res.body as LoginBody).user).toMatchObject({
        authSubject: 'dev-teacher-1',
        firstName: 'Jane',
        lastName: 'Doe',
      });
    });

    it('is idempotent for the same subject (find-or-create, no duplicate)', async () => {
      const first = await login('dev-teacher-1').expect(200);
      const second = await login('dev-teacher-1').expect(200);

      expect((second.body as LoginBody).user.id).toBe(
        (first.body as LoginBody).user.id,
      );
      expect(await userCount()).toBe(1);
    });

    it('creates distinct users for distinct subjects', async () => {
      const a = await login('dev-teacher-1').expect(200);
      const b = await login('dev-teacher-2').expect(200);

      expect((b.body as LoginBody).user.id).not.toBe(
        (a.body as LoginBody).user.id,
      );
      expect(await userCount()).toBe(2);
    });

    it('rejects a request with neither idToken nor code (400)', () =>
      request(server())
        .post('/auth/login')
        .send({ provider: 'google' })
        .expect(400));

    it('rejects a request with both idToken and code (400)', () =>
      request(server())
        .post('/auth/login')
        .send({ provider: 'google', idToken: 'dev-teacher-1', code: 'abc' })
        .expect(400));

    it('rejects an unknown provider with 400', () =>
      request(server())
        .post('/auth/login')
        .send({ provider: 'myspace', idToken: 'x' })
        .expect(400));
  });

  describe('GET /me', () => {
    it('returns the current user with a valid token', async () => {
      const loginRes = await login('dev-teacher-1').expect(200);
      const body = loginRes.body as LoginBody;

      const res = await request(server())
        .get('/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      const me = res.body as UserBody;

      expect(me.id).toBe(body.user.id);
      expect(me.authSubject).toBe('dev-teacher-1');
    });

    it('rejects a request with no token', () =>
      request(server()).get('/me').expect(401));

    it('rejects a request with a malformed token', () =>
      request(server())
        .get('/me')
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401));
  });
});
