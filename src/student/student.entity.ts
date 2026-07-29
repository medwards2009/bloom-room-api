import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Enrollment } from '../enrollment/enrollment.entity';
import { Teacher } from '../teacher/teacher.entity';

/**
 * A student on a teacher's roster. This is the teacher-first MVP: students are
 * owned by the authenticated teacher (not a school). Teacher access to a student
 * is by direct ownership (`teacherId`) plus their enrollment in the teacher's
 * classes.
 *
 * Diverges from the reference `student.entity.ts` in two ways, mirroring what
 * Chunk 5 did to Teacher:
 *  - the required `schoolId` FK + CASCADE from `School` becomes a nullable
 *    `schoolId` column with no relation (the `School` entity doesn't exist yet);
 *  - a `teacherId` owner is added (set from auth, never the request body).
 *
 * The `behaviors`, `behaviorEntries` and `reports` inverse relations are deferred
 * to later chunks (those entities don't exist yet). Only `enrollments` is wired.
 */
@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => Teacher, (teacher) => teacher.students, {
    onDelete: 'CASCADE',
  })
  // Snake-case join column so it coincides with the `teacherId` column above
  // (SnakeNamingStrategy leaves an explicit JoinColumn name untouched).
  @JoinColumn({ name: 'teacher_id' })
  teacher: Teacher;

  // Reserved for future school linkage; stays null in the teacher-first MVP.
  // Becomes a required FK to `schools` when Chunk 4 introduces the School entity.
  @Column({ type: 'uuid', nullable: true })
  schoolId: string | null;

  @Column({ type: 'varchar' })
  firstName: string;

  @Column({ type: 'varchar' })
  lastName: string;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
  enrollments: Enrollment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
