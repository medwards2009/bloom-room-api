import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { Class } from './class.entity';
import { ClassService } from './class.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

/**
 * Classes CRUD, scoped to the authenticated user's teacher profile. Classes that
 * aren't theirs return 404 (not 403). `teacherId` is always derived from auth.
 */
@ApiTags('classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassController {
  constructor(private readonly classes: ClassService) {}

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateClassDto,
  ): Promise<Class> {
    return this.classes.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User): Promise<Class[]> {
    return this.classes.findAll(user);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Class> {
    return this.classes.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
  ): Promise<Class> {
    return this.classes.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.classes.remove(user, id);
  }
}
