import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ClassColor } from '../../common/enums';

/**
 * Any subset of the create fields (all optional). `teacherId` is never accepted
 * here either. Written out explicitly rather than via a PartialType helper so
 * this chunk stays free of extra mapping deps (@nestjs/swagger /
 * @nestjs/mapped-types), neither of which is on the base branch yet.
 */
export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  gradeLevel?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subject?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  period?: string;

  @IsOptional()
  @IsEnum(ClassColor)
  color?: ClassColor;
}
