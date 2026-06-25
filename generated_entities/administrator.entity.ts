import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { School } from './school.entity';

@Entity('administrators')
@Unique('uq_administrator_user', ['userId'])
export class Administrator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.administrator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, (school) => school.administrators, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'schoolId' })
  school: School;

  @Column({ type: 'varchar' })
  firstName: string;

  @Column({ type: 'varchar' })
  lastName: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
