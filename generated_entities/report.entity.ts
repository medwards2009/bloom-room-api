import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ReportPeriodType } from './enums';
import { Student } from './student.entity';

// Shape of the computed snapshot stored in the data column. Percentages are
// frozen at generation time so editing entries later can't change a past report.
export interface ReportData {
  overallPercent: number;
  perSubject: Array<{
    subject: string;
    classId: string;
    percent: number;
    yesCount: number;
    totalCount: number;
  }>;
}

@Entity('reports')
@Index('ix_report_student_period', ['studentId', 'periodType', 'periodStart'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, (student) => student.reports, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column({ type: 'enum', enum: ReportPeriodType })
  periodType: ReportPeriodType;

  @Column({ type: 'date' })
  periodStart: string;

  @Column({ type: 'date' })
  periodEnd: string;

  @Column({ type: 'jsonb' })
  data: ReportData;

  @CreateDateColumn({ type: 'timestamptz' })
  generatedAt: Date;
}
