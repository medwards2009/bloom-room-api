import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassColor } from '../common/enums';
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
    private readonly teachers: TeacherService,
  ) {}

  async create(user: User, dto: CreateClassDto): Promise<Class> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    const klass = this.classes.create({
      ...dto,
      color: dto.color ?? ClassColor.CORAL,
      teacherId: teacher.id,
    });
    return this.classes.save(klass);
  }

  async findAll(user: User): Promise<Class[]> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    return this.classes.find({
      where: { teacherId: teacher.id },
      order: { createdAt: 'ASC' },
    });
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
    return klass;
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
    return this.classes.save(klass);
  }

  async remove(user: User, id: string): Promise<void> {
    const klass = await this.findOne(user, id);
    await this.classes.remove(klass);
  }
}
