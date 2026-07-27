import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from './teacher.entity';

/** Postgres unique-violation SQLSTATE — a lost race on concurrent first access. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '23505'
  );
}

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(Teacher)
    private readonly teachers: Repository<Teacher>,
  ) {}

  /**
   * Resolve the teacher profile for the authenticated user, creating it lazily on
   * first use. Full onboarding (school assignment) is deferred to Chunk 4; until
   * then a profile is minted with a null `schoolId` so class operations work.
   */
  async findOrCreateByUserId(userId: string): Promise<Teacher> {
    const existing = await this.teachers.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }

    const teacher = this.teachers.create({ userId });
    try {
      return await this.teachers.save(teacher);
    } catch (err) {
      // Lost a race on a concurrent first access; the other insert won.
      if (isUniqueViolation(err)) {
        const found = await this.teachers.findOne({ where: { userId } });
        if (found) return found;
      }
      throw err;
    }
  }
}
