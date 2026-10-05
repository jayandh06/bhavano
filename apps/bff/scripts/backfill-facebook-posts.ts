/**
 * One-off backfill: shares every already-live listing to the Bhavano Facebook Page.
 *
 * `ListingsService.runPostLiveSideEffects` only fires `NotificationsService.publishToFacebookPage`
 * for a listing going live *from now on* (docs/plans/facebook-page-publishing.md) — this script
 * covers everything that was already live before that code shipped.
 *
 * Idempotent / resumable: candidates are listings with `status: 'active'`, `publishState: 'live'`
 * and no existing `ListingNotificationLog` row for `channel: 'facebook', kind: 'posted'` — the same
 * row the live path writes on success — so re-running after an interruption only posts what's
 * still missing, same shape as the live-path's own "have I already done this" check.
 *
 * Reuses `NotificationsService.publishToFacebookPage` (message/link building, the Facebook Graph
 * API call, and `FacebookProvider`'s best-effort logging) by constructing it directly rather than
 * through Nest's DI container — same approach as scripts/check-visit-merge.ts takes with
 * AnalyticsService. The service's other providers (email/WhatsApp/MSG91) are never called by this
 * one method, so they're stubbed rather than wired up for real.
 *
 * `formatListingPrice`'s per-category per-unit logic lives on `ListingsService` as a private
 * method and isn't reusable from here — reproduced below from the same category field config
 * (`CATEGORY_FIELD_CONFIG`) it's actually built from, rather than approximated, so a per-sqft
 * Plot/Commercial listing's post shows the same rate the site does.
 *
 * Run inside the bff container (needs DATABASE_URL and the FACEBOOK_* vars):
 *   docker compose -f docker-compose.prod.yml --env-file .env exec bff \
 *     npx tsx scripts/backfill-facebook-posts.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import type { EmailProvider } from '../src/notifications/providers/email.provider';
import type { WhatsappProvider } from '../src/notifications/providers/whatsapp.provider';
import type { Msg91Provider } from '../src/notifications/providers/msg91.provider';
import { FacebookProvider } from '../src/notifications/providers/facebook.provider';
import { NotificationsService } from '../src/notifications/notifications.service';
import {
  CATEGORY_FIELD_CONFIG,
  type FieldDef,
} from '@bhavano/types/categoryFields';
import { areaUnitShortLabel, type AreaUnit } from '@bhavano/types/areaUnit';
import type { ListingCategory } from '@bhavano/types';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const config = {
  get: (key: string) => process.env[key],
} as unknown as ConfigService;
const callLogger = {
  info: (fields: unknown, msg: string) =>
    console.log(msg, JSON.stringify(fields)),
  error: (fields: unknown, msg: string) =>
    console.error(msg, JSON.stringify(fields)),
} as unknown as PinoLogger;

const notifications = new NotificationsService(
  {} as unknown as EmailProvider, // unused by publishToFacebookPage
  {} as unknown as WhatsappProvider, // unused by publishToFacebookPage
  {} as unknown as Msg91Provider, // unused by publishToFacebookPage
  new FacebookProvider(config, callLogger),
  config,
);

const priceFormatter = new Intl.NumberFormat('en-IN');

function areaFieldFor(category: ListingCategory): FieldDef | undefined {
  return CATEGORY_FIELD_CONFIG[category].find((f) => f.type === 'area');
}

/** Mirrors ListingsService.formatListingPrice exactly — see that method's own comment for why
 * the stored `price` is always the whole-rupee total and this is the only place that re-derives
 * a per-unit rate from it for display. */
function formatListingPrice(listing: {
  category: ListingCategory;
  price: number;
  priceUnit: string | null;
  attributes: unknown;
}): string {
  if (listing.price === 0) return 'Contact for price';
  const areaField = areaFieldFor(listing.category);
  const attrs = (listing.attributes as Record<string, unknown> | null) ?? {};
  const areaRaw = areaField ? attrs[areaField.key] : undefined;
  const areaValue = typeof areaRaw === 'number' ? areaRaw : Number(areaRaw);
  const perUnit =
    !listing.priceUnit ||
    !areaField ||
    !Number.isFinite(areaValue) ||
    areaValue <= 0
      ? null
      : Math.round(listing.price / areaValue);
  if (perUnit === null || !listing.priceUnit) {
    return `₹${priceFormatter.format(listing.price)}`;
  }
  return `₹${priceFormatter.format(perUnit)}/${areaUnitShortLabel(listing.priceUnit as AreaUnit, perUnit)}`;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  console.log(dryRun ? 'DRY RUN — nothing will be posted\n' : '');

  const candidates = await prisma.listing.findMany({
    where: {
      status: 'active',
      publishState: 'live',
      notificationLogs: { none: { channel: 'facebook', kind: 'posted' } },
    },
    include: {
      city: { select: { name: true } },
      area: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  console.log(
    `${candidates.length} live listing(s) not yet posted to Facebook`,
  );

  let posted = 0;
  let failed = 0;

  for (const listing of candidates) {
    const priceText =
      formatListingPrice(listing) +
      (listing.price === 0 ? '' : ` ${listing.priceQualifier}`);

    if (dryRun) {
      console.log(
        `  would post: ${listing.id} — ${listing.title} (${priceText})`,
      );
      posted++;
      continue;
    }

    try {
      const result = await notifications.publishToFacebookPage({
        id: listing.id,
        slug: listing.slug,
        category: listing.category,
        transactionType: listing.transactionType,
        cityName: listing.city.name,
        area: listing.area.name,
        title: listing.title,
        priceText,
      });
      if (!result) {
        console.error(
          `  skipped (unconfigured or post failed): ${listing.id} — ${listing.title}`,
        );
        failed++;
        continue;
      }
      await prisma.listingNotificationLog.create({
        data: {
          listingId: listing.id,
          kind: 'posted',
          channel: result.channel,
          providerMessageId: result.messageId ?? null,
        },
      });
      console.log(
        `  posted: ${listing.id} — ${listing.title} (post ${result.messageId})`,
      );
      posted++;
    } catch (error) {
      console.error(`  errored: ${listing.id} — ${listing.title}:`, error);
      failed++;
    }

    // Stay well under Graph API rate limits for a bulk run — this is a one-off script, not a
    // latency-sensitive path.
    if (!dryRun) await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log(
    `\n${dryRun ? 'would post' : 'posted'} ${posted}, failed ${failed}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
