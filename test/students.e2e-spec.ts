import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/e2e';

interface StudentBody {
  id: string;
  teacherId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

interface ClassChip {
  id: string;
  name: string | null;
  gradeLevel: string | null;
  subject: string;
  period: string;
  color: string;
}

interface StudentDetailBody extends StudentBody {
  classes: ClassChip[];
}

interface ClassBody {
  id: string;
}

interface LoginBody {
  accessToken: string;
  user: { id: string };
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

describe('Students + Enrollment (e2e)', () => {
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

  const makeClass = async (token: string): Promise<string> => {
    const res = await request(server())
      .post('/classes')
      .set('Authorization', auth(token))
      .send({ name: 'Sunflower Room', subject: 'Rm 104', period: 'Daily' })
      .expect(201);
    return (res.body as ClassBody).id;
  };

  const addStudent = async (
    token: string,
    classId: string,
    firstName: string,
    lastName: string,
  ): Promise<StudentBody> => {
    const res = await request(server())
      .post(`/classes/${classId}/students`)
      .set('Authorization', auth(token))
      .send({ firstName, lastName })
      .expect(201);
    return res.body as StudentBody;
  };

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  beforeEach(async () => {
    // CASCADE clears teachers + classes + students + enrollments along with users.
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /classes/:id/students', () => {
    it('creates a student and enrolls them in the class (201)', async () => {
      const token = await tokenFor('dev-teacher-1');
      const classId = await makeClass(token);

      const body = await addStudent(token, classId, 'Amara', 'Okafor');
      expect(body.id).toEqual(expect.any(String));
      expect(body).toMatchObject({ firstName: 'Amara', lastName: 'Okafor' });
      expect(body.teacherId).toEqual(expect.any(String));
      // schoolId is reserved/null and must not leak into the response.
      expect(body).not.toHaveProperty('schoolId');

      // Exactly one enrollment row was written for this student.
      const rows: Array<{ count: number }> = await dataSource.query(
        'SELECT count(*)::int AS count FROM enrollments WHERE student_id = $1',
        [body.id],
      );
      expect(rows[0].count).toBe(1);
    });

    it('derives teacherId from auth, ignoring any body value', async () => {
      const token = await tokenFor('dev-teacher-1');
      const classId = await makeClass(token);

      const res = await request(server())
        .post(`/classes/${classId}/students`)
        .set('Authorization', auth(token))
        .send({ firstName: 'Amara', lastName: 'Okafor', teacherId: NIL_UUID })
        .expect(201);
      expect((res.body as StudentBody).teacherId).not.toBe(NIL_UUID);
    });

    it('rejects blank / missing names (400)', async () => {
      const token = await tokenFor('dev-teacher-1');
      const classId = await makeClass(token);

      await request(server())
        .post(`/classes/${classId}/students`)
        .set('Authorization', auth(token))
        .send({ firstName: 'Amara' })
        .expect(400);

      await request(server())
        .post(`/classes/${classId}/students`)
        .set('Authorization', auth(token))
        .send({ firstName: '   ', lastName: 'Okafor' })
        .expect(400);
    });

    it("returns 404 adding to another teacher's class", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const classId = await makeClass(t1);

      await request(server())
        .post(`/classes/${classId}/students`)
        .set('Authorization', auth(t2))
        .send({ firstName: 'Amara', lastName: 'Okafor' })
        .expect(404);
    });

    it('requires a bearer token (401)', () =>
      request(server())
        .post(`/classes/${NIL_UUID}/students`)
        .send({ firstName: 'Amara', lastName: 'Okafor' })
        .expect(401));

    it('returns 400 for a non-uuid class id', async () => {
      const token = await tokenFor('dev-teacher-1');
      await request(server())
        .post('/classes/not-a-uuid/students')
        .set('Authorization', auth(token))
        .send({ firstName: 'Amara', lastName: 'Okafor' })
        .expect(400);
    });
  });

  describe('GET /classes/:id/students', () => {
    it('lists students enrolled in the class', async () => {
      const token = await tokenFor('dev-teacher-1');
      const classId = await makeClass(token);
      await addStudent(token, classId, 'Amara', 'Okafor');
      await addStudent(token, classId, 'Leo', 'Martinez');

      const res = await request(server())
        .get(`/classes/${classId}/students`)
        .set('Authorization', auth(token))
        .expect(200);
      const list = res.body as StudentBody[];
      expect(list).toHaveLength(2);
      expect(list.map((s) => s.firstName)).toEqual(['Amara', 'Leo']);
    });

    it("returns 404 listing another teacher's class", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const classId = await makeClass(t1);
      await addStudent(t1, classId, 'Amara', 'Okafor');

      await request(server())
        .get(`/classes/${classId}/students`)
        .set('Authorization', auth(t2))
        .expect(404);
    });
  });

  describe('DELETE /classes/:id/students/:studentId', () => {
    it('unenrolls the student but keeps the student record (204)', async () => {
      const token = await tokenFor('dev-teacher-1');
      const classId = await makeClass(token);
      const student = await addStudent(token, classId, 'Amara', 'Okafor');

      await request(server())
        .delete(`/classes/${classId}/students/${student.id}`)
        .set('Authorization', auth(token))
        .expect(204);

      // Enrollment gone...
      await request(server())
        .get(`/classes/${classId}/students`)
        .set('Authorization', auth(token))
        .expect(200)
        .expect((r) => expect(r.body as StudentBody[]).toHaveLength(0));

      // ...but the student record survives (unenroll ≠ delete).
      await request(server())
        .get(`/students/${student.id}`)
        .set('Authorization', auth(token))
        .expect(200);
    });

    it('returns 404 when the student is not enrolled in the class', async () => {
      const token = await tokenFor('dev-teacher-1');
      const classA = await makeClass(token);
      const classB = await makeClass(token);
      const student = await addStudent(token, classA, 'Amara', 'Okafor');

      await request(server())
        .delete(`/classes/${classB}/students/${student.id}`)
        .set('Authorization', auth(token))
        .expect(404);
    });

    it("returns 404 unenrolling from another teacher's class", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const classId = await makeClass(t1);
      const student = await addStudent(t1, classId, 'Amara', 'Okafor');

      await request(server())
        .delete(`/classes/${classId}/students/${student.id}`)
        .set('Authorization', auth(t2))
        .expect(404);

      // The enrollment is untouched.
      const rows: Array<{ count: number }> = await dataSource.query(
        'SELECT count(*)::int AS count FROM enrollments WHERE student_id = $1',
        [student.id],
      );
      expect(rows[0].count).toBe(1);
    });
  });

  describe('GET /students/:id', () => {
    it('returns the student plus the classes they are enrolled in', async () => {
      const token = await tokenFor('dev-teacher-1');
      const classA = await makeClass(token);
      const student = await addStudent(token, classA, 'Amara', 'Okafor');
      // Enroll the same student in a second class via a fresh add is not possible
      // (each add mints a new student), so detail reflects the one enrollment.

      const res = await request(server())
        .get(`/students/${student.id}`)
        .set('Authorization', auth(token))
        .expect(200);
      const body = res.body as StudentDetailBody;
      expect(body.id).toBe(student.id);
      expect(body).not.toHaveProperty('schoolId');
      expect(body.classes).toHaveLength(1);
      expect(body.classes[0]).toMatchObject({
        id: classA,
        name: 'Sunflower Room',
        subject: 'Rm 104',
        period: 'Daily',
        color: 'coral',
      });
    });

    it("returns 404 for another teacher's student (no existence leak)", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const classId = await makeClass(t1);
      const student = await addStudent(t1, classId, 'Amara', 'Okafor');

      await request(server())
        .get(`/students/${student.id}`)
        .set('Authorization', auth(t2))
        .expect(404);
    });

    it('returns 400 for a non-uuid id', async () => {
      const token = await tokenFor('dev-teacher-1');
      await request(server())
        .get('/students/not-a-uuid')
        .set('Authorization', auth(token))
        .expect(400);
    });
  });

  describe('GET /students', () => {
    it("returns only the authenticated teacher's students", async () => {
      const t1 = await tokenFor('dev-teacher-1');
      const t2 = await tokenFor('dev-teacher-2');
      const c1 = await makeClass(t1);
      const c2 = await makeClass(t2);
      await addStudent(t1, c1, 'Amara', 'Okafor');
      await addStudent(t1, c1, 'Leo', 'Martinez');
      await addStudent(t2, c2, 'Ella', 'Thompson');

      const res = await request(server())
        .get('/students')
        .set('Authorization', auth(t1))
        .expect(200);
      const list = res.body as StudentBody[];
      expect(list).toHaveLength(2);
      expect(list.map((s) => s.firstName)).toEqual(['Amara', 'Leo']);
    });
  });
});
