import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ClassColor } from '../../common/enums';

/**
 * Body for creating a class. `teacherId` is never accepted here — it is derived
 * from the authenticated user's teacher profile. `color` defaults to coral when
 * omitted.
 */
export class CreateClassDto {
  /** "Class name", e.g. "Sunflower Room". Optional. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  /** "Grade level", e.g. "Grade 2". Optional. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  gradeLevel?: string;

  /** "Room / Subject", e.g. "Rm 104". Required. */
  @IsString()
  @IsNotEmpty()
  subject: string;

  /** "Meeting schedule", e.g. "Mon-Thu · 9:30 AM". Required. */
  @IsString()
  @IsNotEmpty()
  period: string;

  /** Accent colour key; defaults to coral when omitted. */
  @IsOptional()
  @IsEnum(ClassColor)
  color?: ClassColor;
}
