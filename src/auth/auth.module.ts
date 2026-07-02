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
import {
  GoogleExchangeConfig,
  GoogleTokenVerifier,
} from './token-verifier/google-token-verifier';
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

        // Auth-code exchange needs a specific web client id + secret pair. When
        // both are set, the web id must be in the audience allow-list.
        const webClientId = config.get<string>('GOOGLE_WEB_CLIENT_ID');
        const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
        let exchange: GoogleExchangeConfig | undefined;
        if (webClientId && clientSecret) {
          if (!clientIds.includes(webClientId)) {
            throw new Error(
              'GOOGLE_WEB_CLIENT_ID must be included in GOOGLE_CLIENT_IDS',
            );
          }
          exchange = { clientId: webClientId, clientSecret };
        }

        const google = clientIds.length
          ? new GoogleTokenVerifier(clientIds, exchange)
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
