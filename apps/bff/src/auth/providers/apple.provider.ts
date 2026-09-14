import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';

export interface AppleProfile {
  appleId: string;
  /** Present on every authorization as long as the email scope was granted (unlike `name`,
   * which Apple only ever includes in the native SDK's one-time response, never in the token
   * itself — see AuthService.loginWithApple). May be a Private Relay address. */
  email?: string;
}

interface AppleIdTokenPayload extends jwt.JwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
}

/**
 * Verifies a Sign in with Apple identity token client-side handed up by
 * `expo-apple-authentication` — mirrors GoogleProvider's shape (a verified profile in, an
 * UnauthorizedException on anything wrong), but against Apple's rotating JWKS instead of a
 * library that already knows Google's keys, since no equivalent "apple-auth-library" is as
 * established as `google-auth-library`. `jwks-rsa` handles fetching/caching/rotating the actual
 * signing keys — reimplementing that by hand for a token-verification path is exactly the kind of
 * thing worth a battle-tested dependency for.
 */
@Injectable()
export class AppleProvider {
  private readonly logger = new Logger(AppleProvider.name);
  private readonly client = jwksClient({
    jwksUri: APPLE_JWKS_URI,
    cache: true,
    rateLimit: true,
  });

  constructor(private readonly config: ConfigService) {}

  /** The native SDK's identity token carries the app's bundle id as `aud` directly (unlike
   * Google's separate web/iOS/Android client ids) — Sign in with Apple has no separate "mobile
   * client id" concept for a native, non-web integration. */
  private expectedAudience(): string {
    // `||`, not `??`: docker-compose.prod.yml substitutes an unset ${APPLE_BUNDLE_ID} with an
    // empty string rather than omitting the key, which `??` doesn't treat as "unset" — this
    // silently made the real bundle id fallback below unreachable in prod.
    return this.config.get<string>('APPLE_BUNDLE_ID') || 'com.finfolia.bhavano';
  }

  private getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
    this.client.getSigningKey(header.kid, (err, key) => {
      if (err || !key) {
        callback(err ?? new Error('No signing key found'));
        return;
      }
      callback(null, key.getPublicKey());
    });
  };

  async verifyIdentityToken(identityToken: string): Promise<AppleProfile> {
    const audience = this.expectedAudience();
    if (!audience) {
      throw new InternalServerErrorException(
        'APPLE_BUNDLE_ID is not configured — set it in apps/bff/.env to enable Apple login.',
      );
    }

    const payload = await new Promise<AppleIdTokenPayload | null>((resolve) => {
      jwt.verify(
        identityToken,
        this.getKey,
        { issuer: APPLE_ISSUER, audience, algorithms: ['RS256'] },
        (err, decoded) => {
          if (err || !decoded || typeof decoded === 'string') {
            this.logger.warn(
              `Apple identity token verification failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            resolve(null);
            return;
          }
          resolve(decoded as AppleIdTokenPayload);
        },
      );
    });

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid Apple identity token');
    }

    // `email_verified` comes back as the literal string "true"/"false" in some Apple token
    // versions, a real boolean in others — normalise rather than trust either shape blindly.
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    return {
      appleId: payload.sub,
      email: emailVerified ? payload.email : undefined,
    };
  }
}
