import { ClassColor } from '../../common/enums';

/**
 * Response shapes for the students API. Plain objects (not the raw entity) so the
 * reserved `schoolId` column and relation graph never leak into responses — the
 * apps consume exactly these fields.
 */

/** Student as returned by create + the class-roster list. */
export interface StudentResponse {
  id: string;
  teacherId: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
}

/** A class chip on the student-detail page (the classes a student is enrolled in). */
export interface StudentClassChip {
  id: string;
  name: string | null;
  gradeLevel: string | null;
  subject: string;
  period: string;
  color: ClassColor;
}

/** Student detail (`GET /students/:id`): the base fields plus enrolled classes. */
export interface StudentDetailResponse extends StudentResponse {
  classes: StudentClassChip[];
}
