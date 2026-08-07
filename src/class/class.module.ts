import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherModule } from '../teacher/teacher.module';
import { ClassController } from './class.controller';
import { Class } from './class.entity';
import { ClassService } from './class.service';
import { Enrollment } from '../enrollment/enrollment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Class, Enrollment]), TeacherModule],
  controllers: [ClassController],
  providers: [ClassService],
})
export class ClassModule {}
