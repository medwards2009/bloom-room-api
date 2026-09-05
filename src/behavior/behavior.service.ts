import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../student/student.entity';
import { TeacherService } from '../teacher/teacher.service';
import { User } from '../user/user.entity';
import { Behavior } from './behavior.entity';
import { BehaviorResponse } from './dto/behavior-response.dto';
import { CreateBehaviorDto } from './dto/create-behavior.dto';
import { UpdateBehaviorDto } from './dto/update-behavior.dto';

/** Empty/whitespace descriptions collapse to null so we don't store blanks. */
const normalizeDescription = (
  value: string | null | undefined,
): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Per-student behavior goals (Chunk 7). Everything is scoped to the authenticated
 * user's teacher profile, and ownership flows through the student: a goal is the
 * teacher's only if its student is theirs. Anything not owned returns 404 (not
 * 403) so we never leak the existence of another teacher's data. `studentId` is
 * always taken from the route, never the request body.
 */
@Injectable()
export class BehaviorService {
  constructor(
    @InjectRepository(Behavior)
    private readonly behaviors: Repository<Behavior>,
    @InjectRepository(Student)
    private readonly students: Repository<Student>,
    private readonly teachers: TeacherService,
  ) {}

  /** Create a behavior goal on student `:id`. 404 if the student isn't theirs. */
  async create(
    user: User,
    studentId: string,
    dto: CreateBehaviorDto,
  ): Promise<BehaviorResponse> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    await this.assertOwnedStudent(teacher.id, studentId);

    const behavior = this.behaviors.create({
      studentId,
      name: dto.name,
      description: normalizeDescription(dto.description),
    });
    const saved = await this.behaviors.save(behavior);
    return this.toResponse(saved);
  }

  /** The student's behavior goals. 404 if the student isn't theirs. */
  async findByStudent(
    user: User,
    studentId: string,
  ): Promise<BehaviorResponse[]> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    await this.assertOwnedStudent(teacher.id, studentId);

    const rows = await this.behaviors.find({
      where: { studentId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((b) => this.toResponse(b));
  }

  /** Update a goal's name/description. 404 if it isn't the teacher's. */
  async update(
    user: User,
    behaviorId: string,
    dto: UpdateBehaviorDto,
  ): Promise<BehaviorResponse> {
    const behavior = await this.loadOwned(user, behaviorId);
    // Only touch fields that were actually provided (PATCH semantics).
    if (dto.name !== undefined) behavior.name = dto.name;
    if (dto.description !== undefined) {
      behavior.description = normalizeDescription(dto.description);
    }
    await this.behaviors.save(behavior);
    return this.toResponse(behavior);
  }

  /** Delete a goal. 404 if it isn't the teacher's. */
  async remove(user: User, behaviorId: string): Promise<void> {
    const behavior = await this.loadOwned(user, behaviorId);
    await this.behaviors.remove(behavior);
  }

  /** Load a behavior only if its student belongs to the current teacher. */
  private async loadOwned(user: User, behaviorId: string): Promise<Behavior> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    const behavior = await this.behaviors.findOne({
      where: { id: behaviorId },
    });
    // Same 404 whether the goal doesn't exist or isn't theirs — no existence leak.
    if (!behavior) {
      throw new NotFoundException(`Behavior ${behaviorId} not found`);
    }
    const owned = await this.students.findOne({
      where: { id: behavior.studentId, teacherId: teacher.id },
    });
    if (!owned) {
      throw new NotFoundException(`Behavior ${behaviorId} not found`);
    }
    return behavior;
  }

  /** Throws 404 unless the student exists AND belongs to this teacher. */
  private async assertOwnedStudent(
    teacherId: string,
    studentId: string,
  ): Promise<void> {
    const owned = await this.students.findOne({
      where: { id: studentId, teacherId },
    });
    if (!owned) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }
  }

  private toResponse(behavior: Behavior): BehaviorResponse {
    return {
      id: behavior.id,
      studentId: behavior.studentId,
      name: behavior.name,
      description: behavior.description,
      goalType: behavior.goalType,
      createdAt: behavior.createdAt,
    };
  }
}
