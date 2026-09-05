import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { BehaviorService } from './behavior.service';
import { BehaviorResponse } from './dto/behavior-response.dto';
import { CreateBehaviorDto } from './dto/create-behavior.dto';

/**
 * Student-scoped behavior-goal routes. Scoped to the authenticated user's teacher
 * profile: a student that isn't theirs returns 404 (not 403). `:id` is the
 * student id.
 */
@ApiTags('behaviors')
@ApiBearerAuth()
@Controller('students/:id/behaviors')
export class StudentBehaviorsController {
  constructor(private readonly behaviors: BehaviorService) {}

  /** Create a behavior goal for student `:id`. 201. */
  @Post()
  create(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateBehaviorDto,
  ): Promise<BehaviorResponse> {
    return this.behaviors.create(user, studentId, dto);
  }

  /** The behavior goals for student `:id`. */
  @Get()
  list(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) studentId: string,
  ): Promise<BehaviorResponse[]> {
    return this.behaviors.findByStudent(user, studentId);
  }
}
