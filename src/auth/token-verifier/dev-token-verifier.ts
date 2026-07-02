import { UnauthorizedException } from '@nestjs/common';
import { AuthProvider } from '../../common/enums';
import { TokenVerifier, VerifiedIdentity } from './token-verifier';

/**
 * Local-only verifier (AUTH_DEV_MODE=true).
 *
 * Real provider id-tokens are JWTs (header.payload.signature), so if the token
 * looks like one we verify it for real via the wrapped Google verifier and
 * surface any error. A token with no dots is treated as a raw subject, so you
 * can `curl /auth/login` with `idToken: "dev-teacher-1"` and no device.
 */
export class DevTokenVerifier implements TokenVerifier {
  constructor(private readonly real: TokenVerifier | null) {}

  async verify(
    provider: AuthProvider,
    idToken: string,
  ): Promise<VerifiedIdentity> {
    if (idToken.includes('.')) {
      if (!this.real) {
        throw new UnauthorizedException(
          'Received a real id-token but GOOGLE_CLIENT_IDS is not configured',
        );
      }
      return this.real.verify(provider, idToken);
    }

    // Dev subject format: "subject" or "subject|First|Last". Names default to a
    // placeholder so the NOT NULL name columns are satisfied without a real token.
    const [subject, firstName, lastName] = idToken.split('|');
    return {
      provider,
      subject,
      email: null,
      firstName: firstName || 'Dev',
      lastName: lastName || subject,
    };
  }
}
