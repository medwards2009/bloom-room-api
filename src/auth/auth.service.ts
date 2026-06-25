import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserType } from '../common/enums';
import { User } from '../user/user.entity';
import { LoginDto } from './dto/login.dto';
import { TOKEN_VERIFIER } from './token-verifier/token-verifier';
import type {
  TokenVerifier,
  VerifiedIdentity,
} from './token-verifier/token-verifier';

interface JwtPayload {
  sub: string;
  userType: UserType;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '23505'
  );
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  /** Verify a provider token, find-or-create the user, and issue our JWT. */
  async login(dto: LoginDto): Promise<{ accessToken: string; user: User }> {
    const identity = await this.verifier.verify(dto.provider, dto.idToken);
    const user = await this.loginOrCreate(identity);
    const accessToken = await this.issueJwt(user);
    return { accessToken, user };
  }

  /** Resolve our access token back to the live user (used by JwtAuthGuard). */
  async verifyAccessToken(token: string): Promise<User> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return user;
  }

  private async loginOrCreate(identity: VerifiedIdentity): Promise<User> {
    const where = {
      authProvider: identity.provider,
      authSubject: identity.subject,
    };

    const existing = await this.users.findOne({ where });
    if (existing) {
      // Keep the login email fresh if the provider's changed.
      if (identity.email && existing.email !== identity.email) {
        existing.email = identity.email;
        await this.users.save(existing);
      }
      return existing;
    }

    // New users default to teacher; admin promotion is a separate admin action.
    const user = this.users.create({
      userType: UserType.TEACHER,
      email: identity.email,
      authProvider: identity.provider,
      authSubject: identity.subject,
    });

    try {
      return await this.users.save(user);
    } catch (err) {
      // Lost a race on a concurrent first login; the other insert won.
      if (isUniqueViolation(err)) {
        const found = await this.users.findOne({ where });
        if (found) return found;
      }
      throw err;
    }
  }

  private async issueJwt(user: User): Promise<string> {
    const payload: JwtPayload = { sub: user.id, userType: user.userType };
    return this.jwt.signAsync(payload);
  }
}
