import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Teacher } from './teacher.entity';
import { Enrollment } from './enrollment.entity';
import { BehaviorEntry } from './behavior-entry.entity';

@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => Teacher, (teacher) => teacher.classes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'teacherId' })
  teacher: Teacher;

  // String so it holds "1"-"7" or block-schedule labels like "A day" / "B day".
  @Column({ type: 'varchar' })
  period: string;

  @Column({ type: 'varchar' })
  subject: string;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.class)
  enrollments: Enrollment[];

  @OneToMany(() => BehaviorEntry, (entry) => entry.class)
  behaviorEntries: BehaviorEntry[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
