import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherModule } from '../teacher/teacher.module';
import { ClassController } from './class.controller';
import { Class } from './class.entity';
import { ClassService } from './class.service';

@Module({
  imports: [TypeOrmModule.forFeature([Class]), TeacherModule],
  controllers: [ClassController],
  providers: [ClassService],
})
export class ClassModule {}
