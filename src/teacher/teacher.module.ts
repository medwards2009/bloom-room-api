import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Teacher } from './teacher.entity';
import { TeacherService } from './teacher.service';

/**
 * Minimal teacher-profile module (Chunk 5 slice). Exposes TeacherService for
 * lazy find-or-create profile resolution and re-exports the repository. Chunk 4
 * will expand this with the School relation and onboarding endpoints.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Teacher])],
  providers: [TeacherService],
  exports: [TeacherService, TypeOrmModule],
})
export class TeacherModule {}
