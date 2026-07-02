import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AuthProvider } from '../../common/enums';
import { TokenVerifier, VerifiedIdentity, VerifyInput } from './token-verifier';

/** Credentials needed to exchange a web authorization code for tokens. */
export interface GoogleExchangeConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Verifies Google credentials against the allowed client ids. Handles both:
 *  - an id-token (mobile / One-Tap `credential`) — verified directly, and
 *  - an authorization code (the web auth-code popup flow) — exchanged for tokens
 *    first, then the returned id-token is verified.
 * Apple is intentionally not implemented yet — it throws a clear error.
 */
export class GoogleTokenVerifier implements TokenVerifier {
  // No credentials needed to verify an id-token (uses Google's public certs).
  private readonly verifyClient = new OAuth2Client();

  constructor(
    private readonly allowedClientIds: string[],
    private readonly exchange?: GoogleExchangeConfig,
  ) {}

  async verify(input: VerifyInput): Promise<VerifiedIdentity> {
    if (input.provider !== AuthProvider.GOOGLE) {
      throw new UnauthorizedException(
        `Auth provider "${input.provider}" is not supported yet`,
      );
    }

    if (input.code) {
      const idToken = await this.exchangeCode(input.code);
      return this.verifyIdToken(idToken);
    }
    if (input.idToken) {
      return this.verifyIdToken(input.idToken);
    }
    throw new UnauthorizedException('No credential provided');
  }

  /** Exchange a web authorization code for tokens and return the id-token. */
  private async exchangeCode(code: string): Promise<string> {
    if (!this.exchange) {
      throw new UnauthorizedException(
        'Authorization-code login is not configured (missing GOOGLE_WEB_CLIENT_ID / GOOGLE_CLIENT_SECRET)',
      );
    }

    // 'postmessage' is the required redirect_uri for @react-oauth/google's popup
    // auth-code flow; a real URL yields redirect_uri_mismatch.
    const client = new OAuth2Client({
      clientId: this.exchange.clientId,
      clientSecret: this.exchange.clientSecret,
      redirectUri: 'postmessage',
    });

    let idToken: string | null | undefined;
    try {
      const { tokens } = await client.getToken(code);
      idToken = tokens.id_token;
    } catch {
      throw new UnauthorizedException('Failed to exchange Google authorization code');
    }

    if (!idToken) {
      throw new UnauthorizedException('Google code exchange returned no id-token');
    }
    return idToken;
  }

  private async verifyIdToken(idToken: string): Promise<VerifiedIdentity> {
    let payload;
    try {
      const ticket = await this.verifyClient.verifyIdToken({
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

    // given_name / family_name are standard profile claims on a Google id-token.
    if (!payload.given_name || !payload.family_name) {
      throw new UnauthorizedException('Google token did not include a full name');
    }

    return {
      provider: AuthProvider.GOOGLE,
      subject: payload.sub,
      email: payload.email ?? null,
      firstName: payload.given_name,
      lastName: payload.family_name,
    };
  }
}
