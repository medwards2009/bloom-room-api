import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GoalType } from '../common/enums';
import { Student } from '../student/student.entity';

/**
 * A behavior goal tracked for a student (Chunk 7). Scoped to the student — a goal
 * is tracked across all of that student's classes, so ownership flows through the
 * student (a behavior is the teacher's only if its student is). `goalType` is an
 * enum so new types can be added later without a schema change (only `yes_no`
 * exists now). The `entries` inverse relation (daily records) is deferred to
 * Chunk 8, so it is not wired here.
 */
@Entity('behaviors')
export class Behavior {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, (student) => student.behaviors, {
    onDelete: 'CASCADE',
  })
  // Snake-case join column so it coincides with the `studentId` column above
  // (SnakeNamingStrategy leaves an explicit JoinColumn name untouched — otherwise
  // a duplicate, always-null `studentId` column would be synchronized).
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: GoalType, default: GoalType.YES_NO })
  goalType: GoalType;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
