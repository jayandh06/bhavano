import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name?: string;
}

@Injectable()
export class GoogleProvider {
  private readonly logger = new Logger(GoogleProvider.name);
  private readonly client: OAuth2Client;

  constructor(private readonly config: ConfigService) {
    this.client = new OAuth2Client(this.config.get<string>('GOOGLE_CLIENT_ID'));
  }

  /** Every Google OAuth client we own, in one Cloud project. An id_token's `aud` is the client
   * that requested it, so the web client ID alone rejects every mobile sign-in — the iOS app's
   * token carries the iOS client ID and nothing else. Listing them is not a loosening of the
   * check: verifyIdToken still requires `aud` to match one of these exactly, and each is a client
   * whose sign-ins we intend to accept. Never widen this to an unowned client ID. */
  private acceptedAudiences(): string[] {
    return [
      this.config.get<string>('GOOGLE_CLIENT_ID'),
      this.config.get<string>('GOOGLE_IOS_CLIENT_ID'),
      this.config.get<string>('GOOGLE_ANDROID_CLIENT_ID'),
    ].filter((id): id is string => !!id);
  }

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    const audience = this.acceptedAudiences();
    if (audience.length === 0) {
      throw new InternalServerErrorException(
        'No Google client IDs are configured — set GOOGLE_CLIENT_ID (and GOOGLE_IOS_CLIENT_ID / ' +
          'GOOGLE_ANDROID_CLIENT_ID for the mobile apps) in apps/bff/.env to enable Google login.',
      );
    }

    // google-auth-library's message is the only thing that distinguishes an audience mismatch
    // ("Wrong recipient, payload audience != requiredAudience") from an expired token, a bad
    // signature, or a wrong issuer — all of which surface identically as a 401 to the client.
    // Swallowing it silently made this failure undiagnosable. The message names client IDs, which
    // are public identifiers, and never the token itself.
    const ticket = await this.client
      .verifyIdToken({ idToken, audience })
      .catch((err: unknown) => {
        this.logger.warn(
          `Google id_token verification failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      });
    const payload = ticket?.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    return { googleId: payload.sub, email: payload.email, name: payload.name };
  }
}
