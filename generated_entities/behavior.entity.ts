import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { GoalType } from './enums';
import { Student } from './student.entity';
import { BehaviorEntry } from './behavior-entry.entity';

@Entity('behaviors')
export class Behavior {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, (student) => student.behaviors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  // Enum now, so new goal types can be added later without a schema change.
  @Column({ type: 'enum', enum: GoalType, default: GoalType.YES_NO })
  goalType: GoalType;

  @OneToMany(() => BehaviorEntry, (entry) => entry.behavior)
  entries: BehaviorEntry[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
