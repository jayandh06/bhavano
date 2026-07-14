import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name?: string;
}

@Injectable()
export class GoogleProvider {
  private readonly client: OAuth2Client;

  constructor(private readonly config: ConfigService) {
    this.client = new OAuth2Client(this.config.get<string>('GOOGLE_CLIENT_ID'));
  }

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new InternalServerErrorException(
        'GOOGLE_CLIENT_ID is not configured — set it in apps/bff/.env to enable Google login.',
      );
    }

    const ticket = await this.client.verifyIdToken({ idToken, audience: clientId }).catch(() => null);
    const payload = ticket?.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    return { googleId: payload.sub, email: payload.email, name: payload.name };
  }
}
