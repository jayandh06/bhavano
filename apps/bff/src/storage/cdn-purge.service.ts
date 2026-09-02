import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Purges specific URLs from Cloudflare's edge cache, via the zone's purge_cache API.
 *
 * Needed because CDN_BASE_URL (cdn.bhavano.com) is a Cloudflare-fronted R2 bucket, and Cloudflare
 * applies its own default edge cache (currently 4 hours, `max-age=14400`) to static file types
 * like .webp — independent of anything R2StorageService's putObject sets, since it sets no
 * Cache-Control at all. That was never a problem before the listing-photo rotate feature: every
 * variant key was written exactly once and never touched again, so there was nothing to go stale.
 * A rotate rewrites the *same* key, so without purging, every visitor keeps seeing the
 * pre-rotation bytes at that URL until Cloudflare's TTL naturally expires — the admin panel's own
 * `?t=<updatedAt>` cache-buster only fixes this for the admin's own view, since a fresh query
 * string is always a cache miss; the public site requests the bare URL. See
 * docs/plans/listing-photo-orientation.md.
 *
 * Best-effort by design, same convention as WhatsappProvider/EmailProvider: unconfigured logs and
 * skips, a failed purge logs and returns false. A purge failing must never fail the reprocess
 * that triggered it — the photo itself is already correctly updated in R2 either way; a missed
 * purge only means the public URL takes up to the cache TTL to catch up, not that anything is
 * actually wrong with the data.
 */
@Injectable()
export class CdnPurgeService {
  private readonly logger = new Logger(CdnPurgeService.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(
      this.config.get<string>('CLOUDFLARE_API_TOKEN') &&
      this.config.get<string>('CLOUDFLARE_ZONE_ID'),
    );
  }

  /** Cloudflare accepts up to 30 URLs per purge_cache call — comfortably more than the 2 variants
   * (preview + full) a single rotate ever needs to purge at once, so no batching is needed here. */
  async purgeUrls(urls: string[]): Promise<boolean> {
    const token = this.config.get<string>('CLOUDFLARE_API_TOKEN');
    const zoneId = this.config.get<string>('CLOUDFLARE_ZONE_ID');
    if (!token || !zoneId) {
      this.logger.warn(
        `Cloudflare not configured (CLOUDFLARE_API_TOKEN/CLOUDFLARE_ZONE_ID) — skipping purge of ${urls.join(', ')}`,
      );
      return false;
    }
    if (urls.length === 0) return true;

    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ files: urls }),
        },
      );
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(
          `Cloudflare purge failed (${res.status}) for ${urls.join(', ')}: ${body}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Cloudflare purge threw for ${urls.join(', ')}: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }
}
