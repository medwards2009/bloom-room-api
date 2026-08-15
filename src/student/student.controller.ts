import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import {
  StudentDetailResponse,
  StudentResponse,
} from './dto/student-response.dto';
import { StudentService } from './student.service';

/**
 * Top-level student routes, scoped to the authenticated teacher. A student that
 * isn't theirs returns 404 (not 403).
 */
@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
export class StudentController {
  constructor(private readonly students: StudentService) {}

  /** All of the current teacher's students (top-level roster). */
  @Get()
  findAll(@CurrentUser() user: User): Promise<StudentResponse[]> {
    return this.students.findAll(user);
  }

  /** A student plus the classes they're enrolled in (detail page). */
  @Get(':id')
  findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentDetailResponse> {
    return this.students.findOne(user, id);
  }
}
