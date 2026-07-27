import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '../user/user.entity';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class MeController {
  /** Smoke test for the global guard: echoes the authenticated user. */
  @Get('me')
  me(@CurrentUser() user: User): User {
    return user;
  }
}
