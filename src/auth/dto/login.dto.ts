import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AuthProvider } from '../../common/enums';

export class LoginDto {
  @IsEnum(AuthProvider)
  provider: AuthProvider;

  /** Provider id-token (e.g. the `credential` from @react-oauth/google). */
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
