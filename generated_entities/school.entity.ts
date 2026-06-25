import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Teacher } from './teacher.entity';
import { Administrator } from './administrator.entity';
import { Student } from './student.entity';

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @OneToMany(() => Administrator, (administrator) => administrator.school)
  administrators: Administrator[];

  @OneToMany(() => Teacher, (teacher) => teacher.school)
  teachers: Teacher[];

  @OneToMany(() => Student, (student) => student.school)
  students: Student[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
