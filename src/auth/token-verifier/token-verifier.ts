import { AuthProvider } from '../../common/enums';

/** The identity fields we trust after a provider token has been verified. */
export interface VerifiedIdentity {
  provider: AuthProvider;
  subject: string;
  email: string | null;
}

/**
 * Provider-agnostic verification of an OAuth id-token. Implementations: real
 * Google verification, and a dev verifier for local work.
 */
export interface TokenVerifier {
  verify(provider: AuthProvider, idToken: string): Promise<VerifiedIdentity>;
}

/** DI token for the configured TokenVerifier (chosen by AUTH_DEV_MODE). */
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');
