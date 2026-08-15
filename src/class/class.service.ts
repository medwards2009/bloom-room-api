import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassColor } from '../common/enums';
import { Enrollment } from '../enrollment/enrollment.entity';
import { TeacherService } from '../teacher/teacher.service';
import { User } from '../user/user.entity';
import { Class } from './class.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@Injectable()
export class ClassService {
  constructor(
    @InjectRepository(Class)
    private readonly classes: Repository<Class>,
    @InjectRepository(Enrollment)
    private readonly enrollments: Repository<Enrollment>,
    private readonly teachers: TeacherService,
  ) {}

  async create(user: User, dto: CreateClassDto): Promise<Class> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    const klass = this.classes.create({
      ...dto,
      color: dto.color ?? ClassColor.CORAL,
      teacherId: teacher.id,
    });
    const saved = await this.classes.save(klass);
    // A brand-new class has no enrollments yet; report 0 so the response shape
    // matches the read endpoints without an extra count query.
    saved.studentCount = 0;
    return saved;
  }

  async findAll(user: User): Promise<Class[]> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    const classes = await this.classes.find({
      where: { teacherId: teacher.id },
      order: { createdAt: 'ASC' },
    });
    await Promise.all(
      classes.map(async (klass) => {
        klass.studentCount = await this.countStudents(klass.id);
      }),
    );
    return classes;
  }

  async findOne(user: User, id: string): Promise<Class> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    const klass = await this.classes.findOne({
      where: { id, teacherId: teacher.id },
    });
    if (!klass) {
      // 404 (not 403) so we never leak the existence of another teacher's class.
      throw new NotFoundException(`Class ${id} not found`);
    }
    klass.studentCount = await this.countStudents(klass.id);
    return klass;
  }

  /**
   * Live count of students enrolled in a class, computed from the enrollment
   * rows at read time (not a stored counter, so it can't drift out of sync).
   * Uses the same repository idiom as StudentService.findByClass — this fork's
   * query builder has no loadRelationCountAndMap.
   */
  private async countStudents(classId: string): Promise<number> {
    const enrollments = await this.enrollments.find({ where: { classId } });
    return enrollments.length;
  }

  async update(user: User, id: string, dto: UpdateClassDto): Promise<Class> {
    const klass = await this.findOne(user, id);
    // Copy only the fields actually provided. class-transformer sets absent
    // optional fields to `undefined`, so a blind Object.assign would clobber the
    // loaded columns (and the returned object) with those undefineds. teacherId
    // isn't part of the DTO, so ownership can't be reassigned here.
    const updates = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    Object.assign(klass, updates);
    await this.classes.save(klass);
    // `klass` came from findOne, so it already carries a correct studentCount;
    // updating class fields doesn't change enrollment, so keep it as-is.
    return klass;
  }

  async remove(user: User, id: string): Promise<void> {
    const klass = await this.findOne(user, id);
    await this.classes.remove(klass);
  }
}
