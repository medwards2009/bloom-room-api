import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Class } from '../class/class.entity';
import { Enrollment } from '../enrollment/enrollment.entity';
import { TeacherService } from '../teacher/teacher.service';
import { User } from '../user/user.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import {
  StudentClassChip,
  StudentDetailResponse,
  StudentResponse,
} from './dto/student-response.dto';
import { Student } from './student.entity';

/**
 * Students + enrollment, scoped to the authenticated user's teacher profile
 * (teacher-first MVP — students are owned by the teacher, not a school). A
 * class or student that isn't the teacher's returns 404 (not 403) so we never
 * leak the existence of another teacher's data. `teacherId` is always derived
 * from auth, never the request body.
 */
@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(Student)
    private readonly students: Repository<Student>,
    @InjectRepository(Enrollment)
    private readonly enrollments: Repository<Enrollment>,
    @InjectRepository(Class)
    private readonly classes: Repository<Class>,
    private readonly teachers: TeacherService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a student on the teacher's roster AND enroll them in class `:id`, in
   * a single transaction. 404 if the class isn't the teacher's.
   */
  async addToClass(
    user: User,
    classId: string,
    dto: CreateStudentDto,
  ): Promise<StudentResponse> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    await this.assertOwnedClass(teacher.id, classId);

    const student = await this.dataSource.transaction(async (manager) => {
      const created = manager.create(Student, {
        teacherId: teacher.id,
        // Reserved for future school linkage; null in the teacher-first MVP.
        schoolId: null,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      const saved = await manager.save(created);
      const enrollment = manager.create(Enrollment, {
        classId,
        studentId: saved.id,
      });
      await manager.save(enrollment);
      return saved;
    });

    return this.toResponse(student);
  }

  /** Students enrolled in class `:id`. 404 if the class isn't the teacher's. */
  async findByClass(user: User, classId: string): Promise<StudentResponse[]> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    await this.assertOwnedClass(teacher.id, classId);

    const enrollments = await this.enrollments.find({
      where: { classId },
      relations: { student: true },
    });
    return enrollments
      .map((e) => e.student)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((s) => this.toResponse(s));
  }

  /**
   * Unenroll a student from class `:id` — deletes the Enrollment row only, never
   * the Student. 404 if the class isn't the teacher's or the student isn't
   * enrolled in it.
   */
  async removeFromClass(
    user: User,
    classId: string,
    studentId: string,
  ): Promise<void> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    await this.assertOwnedClass(teacher.id, classId);

    const enrollment = await this.enrollments.findOne({
      where: { classId, studentId },
    });
    if (!enrollment) {
      throw new NotFoundException(
        `Student ${studentId} is not enrolled in class ${classId}`,
      );
    }
    await this.enrollments.remove(enrollment);
  }

  /**
   * A student plus the classes they're enrolled in (for the detail page). 404 if
   * the student isn't the teacher's.
   */
  async findOne(user: User, id: string): Promise<StudentDetailResponse> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    const student = await this.students.findOne({
      where: { id, teacherId: teacher.id },
      relations: { enrollments: { class: true } },
    });
    if (!student) {
      throw new NotFoundException(`Student ${id} not found`);
    }

    const classes: StudentClassChip[] = (student.enrollments ?? [])
      .map((e) => e.class)
      .filter((c): c is Class => !!c)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        subject: c.subject,
        period: c.period,
        color: c.color,
      }));

    return { ...this.toResponse(student), classes };
  }

  /** All of the current teacher's students (top-level roster). */
  async findAll(user: User): Promise<StudentResponse[]> {
    const teacher = await this.teachers.findOrCreateByUserId(user.id);
    const students = await this.students.find({
      where: { teacherId: teacher.id },
      order: { createdAt: 'ASC' },
    });
    return students.map((s) => this.toResponse(s));
  }

  /** Throws 404 unless the class exists AND belongs to this teacher. */
  private async assertOwnedClass(
    teacherId: string,
    classId: string,
  ): Promise<void> {
    const owned = await this.classes.findOne({
      where: { id: classId, teacherId },
    });
    if (!owned) {
      throw new NotFoundException(`Class ${classId} not found`);
    }
  }

  private toResponse(student: Student): StudentResponse {
    return {
      id: student.id,
      teacherId: student.teacherId,
      firstName: student.firstName,
      lastName: student.lastName,
      createdAt: student.createdAt,
    };
  }
}
