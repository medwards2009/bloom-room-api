import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { School } from './school.entity';
import { Enrollment } from './enrollment.entity';
import { Behavior } from './behavior.entity';
import { BehaviorEntry } from './behavior-entry.entity';
import { Report } from './report.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Students belong to the school, not a single teacher. Teacher access flows
  // through enrollment (a teacher sees a student enrolled in a class they teach).
  @Column({ type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, (school) => school.students, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'schoolId' })
  school: School;

  @Column({ type: 'varchar' })
  firstName: string;

  @Column({ type: 'varchar' })
  lastName: string;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
  enrollments: Enrollment[];

  @OneToMany(() => Behavior, (behavior) => behavior.student)
  behaviors: Behavior[];

  @OneToMany(() => BehaviorEntry, (entry) => entry.student)
  behaviorEntries: BehaviorEntry[];

  @OneToMany(() => Report, (report) => report.student)
  reports: Report[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
