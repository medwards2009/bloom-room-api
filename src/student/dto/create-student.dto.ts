import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

/** Trim strings so an all-whitespace value collapses to '' and fails IsNotEmpty. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Body for adding a student to a class roster. `teacherId` is never accepted
 * here — it is derived from the authenticated user's teacher profile (the global
 * `whitelist` ValidationPipe also strips any unknown body fields). Both names are
 * required and must be non-blank (an all-whitespace value fails `IsNotEmpty`
 * after the trimming transform).
 */
export class CreateStudentDto {
  /** Student's first name. Required, non-blank. */
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  firstName: string;

  /** Student's last name. Required, non-blank. */
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  lastName: string;
}
