/**
 * Re-makes already-processed listing photos so they pick up the current watermark (a large
 * centered "Bhavano" plus the corner logo — see docs/plans/watermark-centered-wordmark.md).
 * Photos processed before that change carry the old mark, whose text rendered as empty boxes.
 *
 * Doesn't touch any image itself: it sets each finished PhotoVariantJob back to `pending`, and the
 * running PhotoProcessingService rebuilds the variant from the stored original (about 5 jobs every
 * 3 seconds, so a large backlog drains on its own). It also bumps ListingPhoto.updatedAt, which
 * changes the public `?t=` URL so browsers and Next's image cache fetch the new bytes; the worker
 * itself purges the Cloudflare edge copy.
 *
 * `--before=<ISO time>` is required: only jobs last finished before it are requeued. Use the time
 * the new watermark was deployed. A job rebuilt after that moment has a newer updatedAt, so
 * re-running (or running a `--limit` sample first, then the whole set) never redoes the same
 * photo twice.
 *
 * Flags: --before=<ISO time> (required), --dry-run (count only, changes nothing), --limit=<n>.
 *
 * Run: pnpm --filter bff exec tsx prisma/requeuePhotoVariants.ts --before=2026-09-25T12:00:00Z --dry-run
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PHOTO_LOOKUP_CHUNK = 200;

function flag(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

async function main() {
  const beforeRaw = flag('before');
  const before = beforeRaw ? new Date(beforeRaw) : undefined;
  if (!before || Number.isNaN(before.getTime())) {
    throw new Error('Pass --before=<ISO time>, e.g. --before=2026-09-25T12:00:00Z (when the new watermark was deployed).');
  }
  const dryRun = process.argv.includes('--dry-run');
  const limitRaw = flag('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (limitRaw && (!Number.isInteger(limit) || (limit as number) <= 0)) throw new Error('--limit must be a positive integer.');

  const jobs = await prisma.photoVariantJob.findMany({
    where: { status: 'done', updatedAt: { lt: before } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  // A job whose photo has since been deleted would only fail five times against a missing
  // original, so leave those out.
  const existing = new Set<string>();
  for (let i = 0; i < jobs.length; i += PHOTO_LOOKUP_CHUNK) {
    const chunk = jobs.slice(i, i + PHOTO_LOOKUP_CHUNK);
    const photos = await prisma.listingPhoto.findMany({
      where: { OR: chunk.map((j) => ({ listingId: j.listingId, photoNo: j.photoNo })) },
      select: { listingId: true, photoNo: true },
    });
    for (const p of photos) existing.add(`${p.listingId}:${p.photoNo}`);
  }
  const targets = jobs.filter((j) => existing.has(`${j.listingId}:${j.photoNo}`));
  const photoKeys = [...new Set(targets.map((j) => `${j.listingId}:${j.photoNo}`))];

  console.log(
    `${targets.length} variant job(s) across ${photoKeys.length} photo(s) to requeue` +
      ` (${jobs.length - targets.length} skipped: photo no longer exists).`,
  );
  if (dryRun) {
    console.log('Dry run — nothing changed.');
    return;
  }
  if (targets.length === 0) return;

  await prisma.photoVariantJob.updateMany({
    where: { id: { in: targets.map((j) => j.id) }, status: 'done' },
    data: { status: 'pending', attempts: 0, error: null },
  });
  const now = new Date();
  for (const key of photoKeys) {
    const [listingId, photoNo] = key.split(':');
    await prisma.listingPhoto.updateMany({ where: { listingId, photoNo: Number(photoNo) }, data: { updatedAt: now } });
  }
  console.log('Requeued. The photo worker will rebuild them over the next few minutes.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
