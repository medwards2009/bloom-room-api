import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Trim strings so an all-whitespace value collapses to '' and fails IsNotEmpty. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Body for creating a behavior goal on a student. `studentId` comes from the
 * route (never the body) and `goalType` isn't accepted yet (only `yes_no` exists;
 * it defaults on the entity). The global whitelist ValidationPipe strips any
 * unknown body fields.
 */
export class CreateBehaviorDto {
  /** Short goal name, e.g. "Raises hand before speaking". Required, non-blank. */
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  name: string;

  /** Optional longer description of the goal. Blank collapses to null server-side. */
  @IsOptional()
  @IsString()
  @Transform(trim)
  description?: string;
}
