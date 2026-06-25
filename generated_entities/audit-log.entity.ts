import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditAction } from './enums';
import { User } from './user.entity';

@Entity('audit_logs')
@Index('ix_audit_user_created', ['userId', 'createdAt'])
@Index('ix_audit_target', ['targetEntity', 'targetId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.auditLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // create / update / delete / generate_report always logged.
  // view logged conditionally (out-of-scope or cross-school access only).
  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  // Lightweight polymorphic pointer. Not a FK since the target varies
  // (e.g. "student" + that student's uuid).
  @Column({ type: 'varchar' })
  targetEntity: string;

  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
