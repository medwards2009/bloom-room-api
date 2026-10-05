import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Trim strings so an all-whitespace value collapses to '' and fails IsNotEmpty. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Any subset of a behavior goal's editable fields (all optional). `studentId` and
 * `goalType` are never reassigned here. Written out explicitly rather than via a
 * PartialType helper, matching UpdateClassDto. Passing `description: null` (or a
 * blank string) clears the description.
 */
export class UpdateBehaviorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  description?: string | null;
}
