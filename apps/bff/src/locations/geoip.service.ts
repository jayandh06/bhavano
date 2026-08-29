import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { open, type Reader, type CityResponse } from 'maxmind';

export interface GeoIpPoint {
  lat: number;
  lng: number;
}

/**
 * Coarse IP → coordinates, using a local MaxMind GeoLite2-City database.
 *
 * A local database rather than a hosted lookup API on purpose: this runs during the first render
 * of a new visitor's page, and a 50-200ms third-party call there lands directly on LCP, which is
 * a Core Web Vitals ranking factor. An mmap'd lookup is microseconds and cannot rate-limit us.
 *
 * Entirely optional. If GEOIP_DB_PATH is unset or the file is missing, every lookup returns null
 * and callers fall back to their existing default — so an environment without the database (a
 * dev machine, a fresh deploy before the download step has run) behaves exactly as it did before
 * this existed, rather than failing. The database is NOT in the repo or the image: it is ~60MB
 * and must be refreshed periodically, so it is mounted from the host — see
 * scripts/update-geolite.sh and docs/plans/visitor-location-default-city.md.
 */
@Injectable()
export class GeoIpService implements OnModuleInit {
  private readonly logger = new Logger(GeoIpService.name);
  private reader: Reader<CityResponse> | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const path = this.config.get<string>('GEOIP_DB_PATH');
    if (!path) {
      this.logger.log(
        'GEOIP_DB_PATH not set — IP-based city detection is off.',
      );
      return;
    }
    if (!existsSync(path)) {
      this.logger.warn(
        `GEOIP_DB_PATH points at ${path}, which does not exist — IP-based city detection is off.`,
      );
      return;
    }
    try {
      // Opened once at boot, not per request: the reader mmaps the file, so repeated opens would
      // pay the setup cost on every lookup for no benefit.
      this.reader = await open<CityResponse>(path);
      this.logger.log(`GeoLite2 database loaded from ${path}.`);
    } catch (err) {
      this.logger.error(
        `Failed to open ${path} — IP-based city detection is off.`,
        err as Error,
      );
    }
  }

  /** Coordinates for an IP, or null when the database is unavailable, the address is private or
   * malformed, or MaxMind has no location for it. Callers must treat null as "unknown", never as
   * an error — a missing answer here is ordinary. */
  lookup(ip: string | undefined | null): GeoIpPoint | null {
    if (!this.reader || !ip) return null;
    try {
      const found = this.reader.get(ip);
      const loc = found?.location;
      if (
        !loc ||
        typeof loc.latitude !== 'number' ||
        typeof loc.longitude !== 'number'
      )
        return null;
      return { lat: loc.latitude, lng: loc.longitude };
    } catch {
      // maxmind throws on anything that is not a valid address. A junk X-Forwarded-For should
      // cost the visitor their city guess, nothing more.
      return null;
    }
  }
}
