import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/e2e';

interface BehaviorBody {
  id: string;
  studentId: string;
  name: string;
  description: string | null;
  goalType: string;
  createdAt: string;
}

interface ClassBody {
  id: string;
}

interface StudentBody {
  id: string;
}

interface LoginBody {
  accessToken: string;
  user: { id: string };
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

describe('Behavior goals (e2e)', () => {
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

  /** Create a class, enroll a student, and return the student id. */
  const makeStudent = async (token: string): Promise<string> => {
    const cls = await request(server())
      .post('/classes')
      .set('Authorization', auth(token))
      .send({ name: 'Sunflower Room', subject: 'Rm 104', period: 'Daily' })
      .expect(201);
    const classId = (cls.body as ClassBody).id;
    const student = await request(server())
      .post(`/classes/${classId}/students`)
      .set('Authorization', auth(token))
      .send({ firstName: 'Amara', lastName: 'Okafor' })
      .expect(201);
    return (student.body as StudentBody).id;
  };

  const addBehavior = async (
    token: string,
    studentId: string,
    body: Record<string, unknown>,
  ): Promise<BehaviorBody> => {
    const res = await request(server())
      .post(`/students/${studentId}/behaviors`)
      .set('Authorization', auth(token))
      .send(body)
      .expect(201);
    return res.body as BehaviorBody;
  };

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  beforeEach(async () => {
    // CASCADE clears teachers/classes/students/enrollments/behaviors with users.
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /students/:id/behaviors', () => {
    it('creates a behavior goal (201), defaulting goalType to yes_no', async () => {
      const token = await tokenFor('dev-teacher-1');
      const studentId = await makeStudent(token);

      const body = await addBehavior(token, studentId, {
        name: 'Raises hand before speaking',
        description: 'Waits to be called on instead of calling out.',
      });

      expect(body.id).toEqual(expect.any(String));
      expect(body).toMatchObject({
        studentId,
        name: 'Raises hand before speaking',
        description: 'Waits to be called on instead of calling out.',
        goalType: 'yes_no',
      });
    });

    it('allows an omitted description (stored as null)', async () => {
      const token = await tokenFor('dev-teacher-1');
      const studentId = await makeStudent(token);

      const body = await addBehavior(token, studentId, { name: 'Stays in seat' });
      expect(body.description).toBeNull();
    });

    it('collapses a blank description to null', async () => {
      const token = await tokenFor('dev-teacher-1');
      const studentId = await makeStudent(token);

      const body = await addBehavior(token, studentId, {
        name: 'Transitions calmly',
        description: '   ',
      });
      expect(body.description).toBeNull();
    });

    it('rejects a blank / missing name (400)', async () => {
      const token = await tokenFor('dev-teacher-1');
      const studentId = await makeStudent(token);

      await request(server())
        .post(`/students/${studentId}/behaviors`)
        .set('Authorization', auth(token))
        .send({ description: 'no name' })
        .expect(400);

      await request(server())
        .post(`/students/${studentId}/behaviors`)
        .set('Authorization', auth(token))
        .send({ name: '   ' })
        .expect(400);
    });

    it("returns 404 adding to another teacher's student", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const studentId = await makeStudent(t1);

      await request(server())
        .post(`/students/${studentId}/behaviors`)
        .set('Authorization', auth(t2))
        .send({ name: 'Sneaky goal' })
        .expect(404);
    });
  });

  describe('GET /students/:id/behaviors', () => {
    it('lists the student’s goals in creation order', async () => {
      const token = await tokenFor('dev-teacher-1');
      const studentId = await makeStudent(token);
      await addBehavior(token, studentId, { name: 'First' });
      await addBehavior(token, studentId, { name: 'Second' });

      const res = await request(server())
        .get(`/students/${studentId}/behaviors`)
        .set('Authorization', auth(token))
        .expect(200);

      const names = (res.body as BehaviorBody[]).map((b) => b.name);
      expect(names).toEqual(['First', 'Second']);
    });

    it("returns 404 for another teacher's student", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const studentId = await makeStudent(t1);

      await request(server())
        .get(`/students/${studentId}/behaviors`)
        .set('Authorization', auth(t2))
        .expect(404);
    });
  });

  describe('PATCH /behaviors/:id', () => {
    it('updates the name and clears the description with null', async () => {
      const token = await tokenFor('dev-teacher-1');
      const studentId = await makeStudent(token);
      const goal = await addBehavior(token, studentId, {
        name: 'Old name',
        description: 'Old description',
      });

      const res = await request(server())
        .patch(`/behaviors/${goal.id}`)
        .set('Authorization', auth(token))
        .send({ name: 'New name', description: null })
        .expect(200);

      const body = res.body as BehaviorBody;
      expect(body.name).toBe('New name');
      expect(body.description).toBeNull();
    });

    it("returns 404 patching another teacher's goal", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const studentId = await makeStudent(t1);
      const goal = await addBehavior(t1, studentId, { name: 'Theirs' });

      await request(server())
        .patch(`/behaviors/${goal.id}`)
        .set('Authorization', auth(t2))
        .send({ name: 'Hijacked' })
        .expect(404);
    });

    it('returns 404 for an unknown goal id', async () => {
      const token = await tokenFor('dev-teacher-1');
      await request(server())
        .patch(`/behaviors/${NIL_UUID}`)
        .set('Authorization', auth(token))
        .send({ name: 'nope' })
        .expect(404);
    });
  });

  describe('DELETE /behaviors/:id', () => {
    it('deletes the goal (204) and it disappears from the list', async () => {
      const token = await tokenFor('dev-teacher-1');
      const studentId = await makeStudent(token);
      const goal = await addBehavior(token, studentId, { name: 'Temp goal' });

      await request(server())
        .delete(`/behaviors/${goal.id}`)
        .set('Authorization', auth(token))
        .expect(204);

      const res = await request(server())
        .get(`/students/${studentId}/behaviors`)
        .set('Authorization', auth(token))
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it("returns 404 deleting another teacher's goal", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const studentId = await makeStudent(t1);
      const goal = await addBehavior(t1, studentId, { name: 'Theirs' });

      await request(server())
        .delete(`/behaviors/${goal.id}`)
        .set('Authorization', auth(t2))
        .expect(404);
    });
  });
});
