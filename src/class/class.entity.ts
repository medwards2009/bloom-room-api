import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClassColor } from '../common/enums';
import { Enrollment } from '../enrollment/enrollment.entity';
import { Teacher } from '../teacher/teacher.entity';

/**
 * A class taught by a teacher. Named `Class` but referenced as `klass` in
 * relation callbacks (`class` is a reserved word); the table stays `classes`.
 *
 * The `enrollments` inverse relation is wired as of Chunk 6; `behaviorEntries`
 * is still deferred to Chunk 8 (that entity doesn't exist yet).
 */
@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => Teacher, (klass) => klass.classes, {
    onDelete: 'CASCADE',
  })
  // SnakeNamingStrategy passes an explicit JoinColumn name through verbatim, so
  // it must be the snake_case column that `teacherId` above maps to — otherwise a
  // duplicate, always-null `teacherId` column is synchronized and loading the
  // `teacher` relation joins on the empty one.
  @JoinColumn({ name: 'teacher_id' })
  teacher: Teacher;

  // "Class name", e.g. "Sunflower Room". Optional in the design.
  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  // "Grade level", e.g. "Grade 2". Optional in the design.
  @Column({ type: 'varchar', nullable: true })
  gradeLevel: string | null;

  // "Room / Subject", e.g. "Rm 104". Required.
  @Column({ type: 'varchar' })
  subject: string;

  // "Meeting schedule", e.g. "Mon-Thu · 9:30 AM". String so it holds arbitrary
  // schedule labels. Required.
  @Column({ type: 'varchar' })
  period: string;

  // Accent colour key (see ClassColor). Stored as varchar, defaults to `coral`.
  @Column({ type: 'varchar', default: ClassColor.CORAL })
  color: ClassColor;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.class)
  enrollments: Enrollment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
