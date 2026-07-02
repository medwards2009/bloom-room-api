import { UnauthorizedException } from '@nestjs/common';
import { TokenVerifier, VerifiedIdentity, VerifyInput } from './token-verifier';

/**
 * Local-only verifier (AUTH_DEV_MODE=true).
 *
 * An authorization code, or an id-token that looks like a real JWT
 * (header.payload.signature), is verified for real via the wrapped Google
 * verifier. A dot-less id-token is treated as a raw subject, so you can
 * `curl /auth/login` with `idToken: "dev-teacher-1"` and no device.
 */
export class DevTokenVerifier implements TokenVerifier {
  constructor(private readonly real: TokenVerifier | null) {}

  async verify(input: VerifyInput): Promise<VerifiedIdentity> {
    const looksReal = Boolean(input.code) || Boolean(input.idToken?.includes('.'));
    if (looksReal) {
      if (!this.real) {
        throw new UnauthorizedException(
          'Received a real credential but Google auth is not configured',
        );
      }
      return this.real.verify(input);
    }

    // Dev subject format: "subject" or "subject|First|Last". Names default to a
    // placeholder so the NOT NULL name columns are satisfied without a real token.
    const [subject, firstName, lastName] = (input.idToken ?? '').split('|');
    return {
      provider: input.provider,
      subject,
      email: null,
      firstName: firstName || 'Dev',
      lastName: lastName || subject,
    };
  }
}
