import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentResponse } from './dto/student-response.dto';
import { StudentService } from './student.service';

/**
 * Class-scoped roster routes. Everything is scoped to the authenticated user's
 * teacher profile: a class that isn't theirs returns 404 (not 403). `:id` is the
 * class id.
 */
@ApiTags('students')
@ApiBearerAuth()
@Controller('classes/:id/students')
export class ClassStudentsController {
  constructor(private readonly students: StudentService) {}

  /** Create a student on the roster and enroll them in class `:id`. 201. */
  @Post()
  add(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) classId: string,
    @Body() dto: CreateStudentDto,
  ): Promise<StudentResponse> {
    return this.students.addToClass(user, classId, dto);
  }

  /** Students enrolled in class `:id`. */
  @Get()
  list(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) classId: string,
  ): Promise<StudentResponse[]> {
    return this.students.findByClass(user, classId);
  }

  /** Unenroll a student from class `:id` (deletes the enrollment only). 204. */
  @Delete(':studentId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) classId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<void> {
    return this.students.removeFromClass(user, classId, studentId);
  }
}
