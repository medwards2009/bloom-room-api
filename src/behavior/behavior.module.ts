import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../student/student.entity';
import { TeacherModule } from '../teacher/teacher.module';
import { BehaviorController } from './behavior.controller';
import { Behavior } from './behavior.entity';
import { BehaviorService } from './behavior.service';
import { StudentBehaviorsController } from './student-behaviors.controller';

/**
 * Per-student behavior goals (Chunk 7). Registers the Behavior and Student
 * repositories (Student is read here only to verify ownership) and reuses
 * TeacherModule's lazy find-or-create profile resolution.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Behavior, Student]), TeacherModule],
  controllers: [StudentBehaviorsController, BehaviorController],
  providers: [BehaviorService],
})
export class BehaviorModule {}
