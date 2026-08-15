import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Class } from '../class/class.entity';
import { Student } from '../student/student.entity';

/**
 * Join row linking a Student to a Class (the M2M enrollment). Deleting either
 * side cascades the enrollment away. A student can't be enrolled in the same
 * class twice — enforced by the unique (classId, studentId) constraint. Named
 * `klass` in the Class relation callback per repo convention (`class` is a
 * reserved word); the table stays `enrollments`.
 */
@Entity('enrollments')
@Unique('uq_enrollment_class_student', ['classId', 'studentId'])
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  classId: string;

  @ManyToOne(() => Class, (klass) => klass.enrollments, {
    onDelete: 'CASCADE',
  })
  // SnakeNamingStrategy passes an explicit JoinColumn name through verbatim, so
  // it must be the snake_case column that `classId` above maps to — otherwise a
  // duplicate, always-null `classId` column is created and the relation breaks.
  @JoinColumn({ name: 'class_id' })
  class: Class;

  @Column({ type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, (student) => student.enrollments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Student;
}
