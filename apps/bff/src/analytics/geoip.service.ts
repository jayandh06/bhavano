import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { open, type Reader, type CityResponse } from 'maxmind';

export interface GeoIpCity {
  city: string | null;
  region: string | null;
  country: string | null;
}

/**
 * Coarse IP → city/region/country, using a local MaxMind GeoLite2-City database.
 *
 * A local database rather than a hosted lookup API on purpose: an mmap'd lookup is
 * microseconds, cannot rate-limit us, and — unlike a third-party geolocation API — never sends a
 * visitor's IP anywhere outside our own server. See docs/plans/visit-ip-city-logging.md.
 *
 * This is an admin-analytics label only. It must never be used to decide what a visitor sees —
 * see docs/plans/remove-automatic-ip-city-detection.md for why an earlier version of this same
 * idea was removed when it fed the homepage's default city.
 *
 * Entirely optional. If GEOIP_DB_PATH is unset or the file is missing, every lookup returns null
 * and the caller just records the visit without a city guess — an environment without the
 * database (a dev machine, a fresh deploy before the download step has run) behaves exactly as it
 * did before this existed, rather than failing. The database is NOT in the repo or the image: it
 * is ~60MB and must be refreshed periodically, so it is mounted from the host — see
 * scripts/update-geolite.sh.
 */
@Injectable()
export class GeoIpService implements OnModuleInit {
  private readonly logger = new Logger(GeoIpService.name);
  private reader: Reader<CityResponse> | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const path = this.config.get<string>('GEOIP_DB_PATH');
    if (!path) {
      this.logger.log('GEOIP_DB_PATH not set — IP-based city logging is off.');
      return;
    }
    if (!existsSync(path)) {
      this.logger.warn(
        `GEOIP_DB_PATH points at ${path}, which does not exist — IP-based city logging is off.`,
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
        `Failed to open ${path} — IP-based city logging is off.`,
        err as Error,
      );
    }
  }

  /** City/region/country for an IP, or null when the database is unavailable, the address is
   * private or malformed, or MaxMind has no location for it. Callers must treat null as
   * "unknown", never as an error — a missing answer here is ordinary. Field-level nulls are also
   * normal: MaxMind sometimes resolves a country without a city, for instance. */
  lookupCity(ip: string | undefined | null): GeoIpCity | null {
    if (!this.reader || !ip) return null;
    try {
      const found = this.reader.get(ip);
      if (!found) return null;
      const city = found.city?.names?.en ?? null;
      const region = found.subdivisions?.[0]?.names?.en ?? null;
      const country = found.country?.names?.en ?? null;
      if (!city && !region && !country) return null;
      return { city, region, country };
    } catch {
      // maxmind throws on anything that is not a valid address. A junk X-Forwarded-For should
      // cost the visit its city guess, nothing more.
      return null;
    }
  }
}
