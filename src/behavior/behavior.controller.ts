import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { BehaviorService } from './behavior.service';
import { BehaviorResponse } from './dto/behavior-response.dto';
import { UpdateBehaviorDto } from './dto/update-behavior.dto';

/**
 * Behavior-goal routes keyed by the goal id. Scoped to the authenticated user's
 * teacher profile via the goal's owning student: a goal that isn't theirs returns
 * 404 (not 403).
 */
@ApiTags('behaviors')
@ApiBearerAuth()
@Controller('behaviors')
export class BehaviorController {
  constructor(private readonly behaviors: BehaviorService) {}

  /** Update a behavior goal's name/description. */
  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBehaviorDto,
  ): Promise<BehaviorResponse> {
    return this.behaviors.update(user, id, dto);
  }

  /** Delete a behavior goal. 204. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.behaviors.remove(user, id);
  }
}
