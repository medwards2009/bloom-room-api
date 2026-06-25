import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AuthProvider } from '../../common/enums';
import { TokenVerifier, VerifiedIdentity } from './token-verifier';

/**
 * Verifies a Google id-token (the `credential` from @react-oauth/google) against
 * the allowed client ids. Apple is intentionally not implemented yet — it throws
 * a clear error so the stub is obvious.
 */
export class GoogleTokenVerifier implements TokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly allowedClientIds: string[]) {}

  async verify(
    provider: AuthProvider,
    idToken: string,
  ): Promise<VerifiedIdentity> {
    if (provider !== AuthProvider.GOOGLE) {
      throw new UnauthorizedException(
        `Auth provider "${provider}" is not supported yet`,
      );
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.allowedClientIds,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid Google token');
    }

    return {
      provider: AuthProvider.GOOGLE,
      subject: payload.sub,
      email: payload.email ?? null,
    };
  }
}
