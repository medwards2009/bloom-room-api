import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Behavior } from './behavior.entity';
import { Student } from './student.entity';
import { Class } from './class.entity';

@Entity('behavior_entries')
// One record per behavior, per class, per day.
@Unique('uq_entry_behavior_class_date', ['behaviorId', 'classId', 'entryDate'])
// Reports scan by student + date range, so index that path.
@Index('ix_entry_student_date', ['studentId', 'entryDate'])
export class BehaviorEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  behaviorId: string;

  @ManyToOne(() => Behavior, (behavior) => behavior.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'behaviorId' })
  behavior: Behavior;

  // Denormalized from behavior.studentId so weekly reports group by student
  // without an extra join. Deliberate redundancy.
  @Column({ type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, (student) => student.behaviorEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column({ type: 'uuid' })
  classId: string;

  @ManyToOne(() => Class, (klass) => klass.behaviorEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'classId' })
  class: Class;

  @Column({ type: 'boolean' })
  behaviorPresent: boolean;

  @Column({ type: 'date' })
  entryDate: string;

  @Column({ type: 'varchar', nullable: true })
  comment: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
