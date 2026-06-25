import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AuthProvider, UserType } from '../common/enums';

/**
 * Identity table — one row per login. Holds OAuth identity and the user's role
 * discriminator. Role-specific data lives on the teacher/administrator profile
 * tables, which point back here via user_id.
 */
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
  // Login matches on this, not email.
  @Column({ type: 'varchar' })
  authSubject: string;

  // Inverse-side relations (teacher, administrator, auditLogs) are added when
  // those entities land in later chunks. They hold no columns on this table.

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
