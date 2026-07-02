import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AuthProvider } from '../../common/enums';

/**
 * A login carries exactly one credential: an `idToken` (mobile / One-Tap / dev)
 * or an authorization `code` (the web auth-code popup flow). The "exactly one"
 * rule is enforced in AuthService.login.
 */
export class LoginDto {
  @IsEnum(AuthProvider)
  provider: AuthProvider;

  /** Provider id-token (e.g. a One-Tap `credential`, or a raw dev subject). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idToken?: string;

  /** Authorization code from @react-oauth/google's auth-code flow. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;
}
