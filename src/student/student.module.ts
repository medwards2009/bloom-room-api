import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Class } from '../class/class.entity';
import { Enrollment } from '../enrollment/enrollment.entity';
import { TeacherModule } from '../teacher/teacher.module';
import { ClassStudentsController } from './class-students.controller';
import { Student } from './student.entity';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';

/**
 * Students + enrollment (Chunk 6). Registers the Student, Enrollment and Class
 * repositories (Class is read here only to verify ownership) and reuses
 * TeacherModule's lazy find-or-create profile resolution.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Student, Enrollment, Class]),
    TeacherModule,
  ],
  controllers: [ClassStudentsController, StudentController],
  providers: [StudentService],
  exports: [TypeOrmModule],
})
export class StudentModule {}
