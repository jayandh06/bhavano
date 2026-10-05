import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { logThirdPartyCall } from '../../logging/thirdPartyCallLogger';
import { DEFAULT_FACEBOOK_API_VERSION, postToFacebookPage } from './facebook';

/**
 * Posts listings to the Bhavano Facebook Page via Meta's Graph API — see
 * docs/plans/facebook-page-publishing.md.
 *
 * Best-effort by design, same as WhatsappProvider: unconfigured logs and skips, a failed post
 * logs and returns false. Callers are a fire-and-forget side effect of a listing going live and
 * must never fail that for a Facebook outage or a revoked token.
 */
@Injectable()
export class FacebookProvider {
  private readonly logger = new Logger(FacebookProvider.name);

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(FacebookProvider.name)
    private readonly callLogger: PinoLogger,
  ) {}

  get configured(): boolean {
    return Boolean(
      this.config.get<string>('FACEBOOK_PAGE_ID') &&
      this.config.get<string>('FACEBOOK_PAGE_ACCESS_TOKEN'),
    );
  }

  /** Posts `message` to the Page's feed with a link card for `link`. Returns the new post's id,
   * or false if unconfigured or the post failed. */
  async publishListing(message: string, link: string): Promise<string | false> {
    const pageId = this.config.get<string>('FACEBOOK_PAGE_ID');
    const accessToken = this.config.get<string>('FACEBOOK_PAGE_ACCESS_TOKEN');
    if (!pageId || !accessToken) {
      this.logger.warn(
        'Facebook not configured (FACEBOOK_PAGE_ID/FACEBOOK_PAGE_ACCESS_TOKEN) — skipping post',
      );
      return false;
    }
    // `||`, not `??`: docker-compose passes an unset variable through as "", not undefined.
    const apiVersion =
      this.config.get<string>('FACEBOOK_API_VERSION') ||
      DEFAULT_FACEBOOK_API_VERSION;

    const result = await postToFacebookPage({
      pageId,
      accessToken,
      apiVersion,
      message,
      link,
    });

    logThirdPartyCall({
      logger: this.callLogger,
      provider: 'facebook-graph',
      method: 'publishListing',
      url: `https://graph.facebook.com/${apiVersion}/${pageId}/feed`,
      // Never the access token — only the fields this call itself chose to send.
      request: { message, link },
      status: result.status,
      responseText: result.ok
        ? result.responseText
        : (result.responseText ?? result.error),
      ok: result.ok,
    });

    if (!result.ok) {
      this.logger.error(
        `Facebook post failed: ${result.responseText ?? result.error ?? 'unknown error'}`,
      );
      return false;
    }
    return result.postId;
  }
}
