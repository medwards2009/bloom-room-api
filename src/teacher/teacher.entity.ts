import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Class } from '../class/class.entity';
import { Student } from '../student/student.entity';
import { User } from '../user/user.entity';

/**
 * Minimal teacher profile — one row per teaching user, pointing back to the
 * identity in `users`. Classes are scoped to this profile (see ClassService).
 *
 * This is intentionally a slice: the full profile (a required `school_id` FK to
 * a `School` entity, `school_email`, the `User.teacher` inverse relation, and an
 * onboarding flow) lands in Chunk 4. Until then `schoolId` is nullable and the
 * profile is created lazily on first class operation, so classes work without a
 * dedicated onboarding step. The `School` relation is deliberately omitted here
 * because the `School` entity does not exist yet.
 */
@Entity('teachers')
@Unique('uq_teacher_user', ['userId'])
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  // Unidirectional for now: the inverse `User.teacher` relation is deferred to
  // Chunk 4 (User entity keeps its inverse relations commented out until then).
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Nullable until Chunk 4 introduces the School entity + onboarding, which will
  // make this a required FK (`onDelete: 'RESTRICT'`) to `schools`.
  @Column({ type: 'uuid', nullable: true })
  schoolId: string | null;

  @OneToMany(() => Class, (klass) => klass.teacher)
  classes: Class[];

  // Students owned by this teacher (teacher-first MVP; see Student entity). Added
  // in Chunk 6.
  @OneToMany(() => Student, (student) => student.teacher)
  students: Student[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
