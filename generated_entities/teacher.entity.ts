import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { School } from './school.entity';
import { Class } from './class.entity';

@Entity('teachers')
@Unique('uq_teacher_user', ['userId'])
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.teacher, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, (school) => school.teachers, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'schoolId' })
  school: School;

  @Column({ type: 'varchar' })
  firstName: string;

  @Column({ type: 'varchar' })
  lastName: string;

  // Distinct from the login email on User; this is the teacher's work email.
  @Column({ type: 'varchar', nullable: true })
  schoolEmail: string | null;

  @OneToMany(() => Class, (klass) => klass.teacher)
  classes: Class[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
