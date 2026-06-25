import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { UserType, AuthProvider } from './enums';
import { Teacher } from './teacher.entity';
import { Administrator } from './administrator.entity';
import { AuditLog } from './audit-log.entity';

@Entity('users')
@Unique('uq_user_auth_identity', ['authProvider', 'authSubject'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: UserType })
  userType: UserType;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'enum', enum: AuthProvider })
  authProvider: AuthProvider;

  // The stable subject identifier the OAuth provider returns (Google/Apple "sub").
  // This is what login matches on, not email.
  @Column({ type: 'varchar' })
  authSubject: string;

  @OneToOne(() => Teacher, (teacher) => teacher.user)
  teacher: Teacher | null;

  @OneToOne(() => Administrator, (administrator) => administrator.user)
  administrator: Administrator | null;

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: AuditLog[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
