import { Injectable, Logger } from '@nestjs/common';
import type { City } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** How many of a person's most recent located visits to look at. */
const RECENT_VISITS = 30;
/** Users handled per batch, and batches per run, so one run cannot hold the database for long. */
const BATCH = 200;
const MAX_BATCHES = 25;
/** A new account gets this long to answer the city question itself before one is guessed for it. */
const GRACE_MS = 24 * 60 * 60 * 1000;

/** The place name that appears most often, ties going to the most recent. Names compare ignoring
 * case and surrounding spaces; the first spelling seen is returned. Empty input gives null. */
export function mostFrequentPlace(namesNewestFirst: (string | null | undefined)[]): string | null {
  const counts = new Map<string, { name: string; count: number; firstSeen: number }>();
  namesNewestFirst.forEach((raw, index) => {
    const name = raw?.trim();
    if (!name) return;
    const key = name.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { name, count: 1, firstSeen: index });
  });
  let best: { name: string; count: number; firstSeen: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count || (entry.count === best.count && entry.firstSeen < best.firstSeen)) {
      best = entry;
    }
  }
  return best?.name ?? null;
}

/** An approximate city for a person from where their visits came from (`Visit.ipCity`, a MaxMind
 * guess made when the visit was logged). Used two ways, both for people with no profile city: as
 * the pre-selected choice in the "where are you?" step (a suggestion, nothing saved until they
 * confirm), and, for those who skip it, filled in by a daily job and marked `cityFromIp` until they
 * choose their own. India only, and only a city Bhavano serves. See docs/plans/profile-city-from-ip.md. */
@Injectable()
export class UserCityFromIpService {
  private readonly logger = new Logger(UserCityFromIpService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** The served city this person's visits point to, or null if there is no usable guess. */
  async suggestFor(userId: string): Promise<City | null> {
    const visits = await this.prisma.visit.findMany({
      where: { userId, ipCountry: 'IN', ipCity: { not: null } },
      select: { ipCity: true },
      orderBy: { createdAt: 'desc' },
      take: RECENT_VISITS,
    });
    const place = mostFrequentPlace(visits.map((v) => v.ipCity));
    return place ? this.cityForPlace(place) : null;
  }

  /** The served City a GeoIP place name stands for: an admin-set alias (Bangalore → Bengaluru,
   * Bombay → Mumbai…) first, otherwise a served city of that name. */
  private async cityForPlace(place: string): Promise<City | null> {
    const alias = await this.prisma.localityAlias.findFirst({
      where: { name: { equals: place, mode: 'insensitive' } },
      include: { city: true },
    });
    if (alias?.city.isServed) return alias.city;
    return this.prisma.city.findFirst({
      where: { name: { equals: place, mode: 'insensitive' }, isServed: true },
    });
  }

  /** Fills `cityId` for accounts that never chose one. Returns how many were filled. Never touches
   * a city a person set: the write is conditional on `cityId` still being empty. */
  async fillMissingCities(now: Date = new Date()): Promise<number> {
    let filled = 0;
    // Users already looked at and left empty (no usable guess) would come back every time, so each
    // run walks forward by id instead of re-reading the same unguessable ones.
    let after: string | undefined;
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const users = await this.prisma.user.findMany({
        where: {
          cityId: null,
          deletedAt: null,
          createdAt: { lte: new Date(now.getTime() - GRACE_MS) },
          visits: { some: { ipCountry: 'IN', ipCity: { not: null } } },
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      });
      if (users.length === 0) break;
      after = users[users.length - 1].id;
      for (const { id } of users) {
        try {
          const city = await this.suggestFor(id);
          if (!city) continue;
          const result = await this.prisma.user.updateMany({
            where: { id, cityId: null },
            data: { cityId: city.id, cityFromIp: true },
          });
          filled += result.count;
        } catch (error) {
          this.logger.error(`City from IP failed for ${id}: ${error instanceof Error ? error.message : error}`);
        }
      }
      if (users.length < BATCH) break;
    }
    return filled;
  }
}
