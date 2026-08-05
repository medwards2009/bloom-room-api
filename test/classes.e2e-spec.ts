import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/e2e';
import { Class } from '../src/class/class.entity';

interface ClassBody {
  id: string;
  teacherId: string;
  name: string | null;
  gradeLevel: string | null;
  subject: string;
  period: string;
  color: string;
  createdAt: string;
}

interface LoginBody {
  accessToken: string;
  user: { id: string };
}

describe('Classes (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const server = () => app.getHttpServer() as App;

  const tokenFor = async (idToken: string): Promise<string> => {
    const res = await request(server())
      .post('/auth/login')
      .send({ provider: 'google', idToken })
      .expect(200);
    return (res.body as LoginBody).accessToken;
  };

  const auth = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  beforeEach(async () => {
    // CASCADE clears teachers + classes along with users.
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /classes', () => {
    it('creates a class scoped to the authenticated teacher (201)', async () => {
      const token = await tokenFor('dev-teacher-1');
      const res = await request(server())
        .post('/classes')
        .set('Authorization', auth(token))
        .send({
          name: 'Sunflower Room',
          gradeLevel: 'Grade 2',
          subject: 'Rm 104',
          period: 'Mon-Thu · 9:30 AM',
          color: 'sage',
        })
        .expect(201);

      const body = res.body as ClassBody;
      expect(body.id).toEqual(expect.any(String));
      expect(body).toMatchObject({
        name: 'Sunflower Room',
        gradeLevel: 'Grade 2',
        subject: 'Rm 104',
        period: 'Mon-Thu · 9:30 AM',
        color: 'sage',
      });
      expect(body.teacherId).toEqual(expect.any(String));

      // teacherId comes from auth, not the body: a teacher row was minted lazily.
      const teachers: Array<{ count: number }> = await dataSource.query(
        'SELECT count(*)::int AS count FROM teachers',
      );
      expect(teachers[0].count).toBe(1);
    });

    it('defaults color to coral and allows null name/gradeLevel', async () => {
      const token = await tokenFor('dev-teacher-1');
      const res = await request(server())
        .post('/classes')
        .set('Authorization', auth(token))
        .send({ subject: 'Rm 104', period: 'Daily' })
        .expect(201);

      const body = res.body as ClassBody;
      expect(body.color).toBe('coral');
      expect(body.name).toBeNull();
      expect(body.gradeLevel).toBeNull();
    });

    it('ignores a teacherId supplied in the body', async () => {
      const token = await tokenFor('dev-teacher-1');
      const res = await request(server())
        .post('/classes')
        .set('Authorization', auth(token))
        .send({
          subject: 'Rm 104',
          period: 'Daily',
          teacherId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(201);

      expect((res.body as ClassBody).teacherId).not.toBe(
        '00000000-0000-0000-0000-000000000000',
      );
    });

    it('rejects a missing required field (400)', async () => {
      const token = await tokenFor('dev-teacher-1');
      await request(server())
        .post('/classes')
        .set('Authorization', auth(token))
        .send({ subject: 'Rm 104' }) // no period
        .expect(400);
    });

    it('rejects an invalid color (400)', async () => {
      const token = await tokenFor('dev-teacher-1');
      await request(server())
        .post('/classes')
        .set('Authorization', auth(token))
        .send({ subject: 'Rm 104', period: 'Daily', color: 'turquoise' })
        .expect(400);
    });

    it('requires a bearer token (401)', () =>
      request(server())
        .post('/classes')
        .send({ subject: 'Rm 104', period: 'Daily' })
        .expect(401));
  });

  describe('GET /classes', () => {
    it("returns only the authenticated teacher's classes", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');

      await request(server())
        .post('/classes')
        .set('Authorization', auth(t1))
        .send({ subject: 'Rm 104', period: 'Daily' })
        .expect(201);
      await request(server())
        .post('/classes')
        .set('Authorization', auth(t2))
        .send({ subject: 'Rm 205', period: 'Weekly' })
        .expect(201);

      const res = await request(server())
        .get('/classes')
        .set('Authorization', auth(t1))
        .expect(200);
      const list = res.body as ClassBody[];
      expect(list).toHaveLength(1);
      expect(list[0].subject).toBe('Rm 104');
    });
  });

  describe('GET /classes/:id', () => {
    it('returns the class when it belongs to the teacher', async () => {
      const token = await tokenFor('dev-teacher-1');
      const created = await request(server())
        .post('/classes')
        .set('Authorization', auth(token))
        .send({ subject: 'Rm 104', period: 'Daily' })
        .expect(201);
      const id = (created.body as ClassBody).id;

      const res = await request(server())
        .get(`/classes/${id}`)
        .set('Authorization', auth(token))
        .expect(200);
      expect((res.body as ClassBody).id).toBe(id);
    });

    it("returns 404 for another teacher's class (no 403 existence leak)", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const created = await request(server())
        .post('/classes')
        .set('Authorization', auth(t1))
        .send({ subject: 'Rm 104', period: 'Daily' })
        .expect(201);
      const id = (created.body as ClassBody).id;

      await request(server())
        .get(`/classes/${id}`)
        .set('Authorization', auth(t2))
        .expect(404);
    });

    it('returns 400 for a non-uuid id', async () => {
      const token = await tokenFor('dev-teacher-1');
      await request(server())
        .get('/classes/not-a-uuid')
        .set('Authorization', auth(token))
        .expect(400);
    });
  });

  describe('PATCH /classes/:id', () => {
    it('updates a subset of fields', async () => {
      const token = await tokenFor('dev-teacher-1');
      const created = await request(server())
        .post('/classes')
        .set('Authorization', auth(token))
        .send({ subject: 'Rm 104', period: 'Daily', color: 'coral' })
        .expect(201);
      const id = (created.body as ClassBody).id;

      const res = await request(server())
        .patch(`/classes/${id}`)
        .set('Authorization', auth(token))
        .send({ name: 'Renamed', color: 'plum' })
        .expect(200);
      const body = res.body as ClassBody;
      expect(body.name).toBe('Renamed');
      expect(body.color).toBe('plum');
      expect(body.subject).toBe('Rm 104');
    });

    it("returns 404 patching another teacher's class", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const created = await request(server())
        .post('/classes')
        .set('Authorization', auth(t1))
        .send({ subject: 'Rm 104', period: 'Daily' })
        .expect(201);
      const id = (created.body as ClassBody).id;

      await request(server())
        .patch(`/classes/${id}`)
        .set('Authorization', auth(t2))
        .send({ name: 'Hijacked' })
        .expect(404);
    });
  });

  describe('DELETE /classes/:id', () => {
    it('deletes the class and returns 204', async () => {
      const token = await tokenFor('dev-teacher-1');
      const created = await request(server())
        .post('/classes')
        .set('Authorization', auth(token))
        .send({ subject: 'Rm 104', period: 'Daily' })
        .expect(201);
      const id = (created.body as ClassBody).id;

      await request(server())
        .delete(`/classes/${id}`)
        .set('Authorization', auth(token))
        .expect(204);

      await request(server())
        .get(`/classes/${id}`)
        .set('Authorization', auth(token))
        .expect(404);
    });

    it("returns 404 deleting another teacher's class", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const created = await request(server())
        .post('/classes')
        .set('Authorization', auth(t1))
        .send({ subject: 'Rm 104', period: 'Daily' })
        .expect(201);
      const id = (created.body as ClassBody).id;

      await request(server())
        .delete(`/classes/${id}`)
        .set('Authorization', auth(t2))
        .expect(404);
    });
  });

  describe('Class.teacher relation (regression)', () => {
    // Guards the SnakeNamingStrategy @JoinColumn pitfall: if the join column is
    // named 'teacherId' instead of the snake_case 'teacher_id', a duplicate
    // always-null column is synchronized and the relation joins on the empty one,
    // so `teacher` loads as null. This asserts the relation actually populates.
    it('loads the teacher relation via the correct join column', async () => {
      const token = await tokenFor('dev-teacher-1');
      const created = await request(server())
        .post('/classes')
        .set('Authorization', auth(token))
        .send({ subject: 'Rm 104', period: 'Daily' })
        .expect(201);
      const body = created.body as ClassBody;

      const loaded = await dataSource
        .getRepository(Class)
        .findOne({ where: { id: body.id }, relations: { teacher: true } });

      expect(loaded).not.toBeNull();
      expect(loaded?.teacher).toBeTruthy();
      expect(loaded?.teacher?.id).toBe(body.teacherId);
    });
  });
});
