import { AuthProvider } from '../../common/enums';

/** The identity fields we trust after a provider token has been verified. */
export interface VerifiedIdentity {
  provider: AuthProvider;
  subject: string;
  email: string | null;
  firstName: string;
  lastName: string;
}

/**
 * A login credential: exactly one of an id-token (mobile/One-Tap/dev) or an
 * authorization code (the web auth-code popup flow), for a given provider.
 */
export interface VerifyInput {
  provider: AuthProvider;
  idToken?: string;
  code?: string;
}

/**
 * Provider-agnostic verification of a login credential. Implementations: real
 * Google verification (id-token verify + auth-code exchange), and a dev verifier
 * for local work.
 */
export interface TokenVerifier {
  verify(input: VerifyInput): Promise<VerifiedIdentity>;
}

/** DI token for the configured TokenVerifier (chosen by AUTH_DEV_MODE). */
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');
