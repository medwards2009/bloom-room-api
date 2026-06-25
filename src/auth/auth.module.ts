import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MeController } from './me.controller';
import { DevTokenVerifier } from './token-verifier/dev-token-verifier';
import { GoogleTokenVerifier } from './token-verifier/google-token-verifier';
import { TOKEN_VERIFIER, TokenVerifier } from './token-verifier/token-verifier';

function parseClientIds(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

@Module({
  imports: [
    UserModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN'),
        } as JwtSignOptions,
      }),
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    {
      provide: TOKEN_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): TokenVerifier => {
        const clientIds = parseClientIds(config.get<string>('GOOGLE_CLIENT_IDS'));
        const google = clientIds.length
          ? new GoogleTokenVerifier(clientIds)
          : null;

        if (config.get<boolean>('AUTH_DEV_MODE')) {
          return new DevTokenVerifier(google);
        }
        // The Joi schema guarantees GOOGLE_CLIENT_IDS when not in dev mode.
        return google as GoogleTokenVerifier;
      },
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
