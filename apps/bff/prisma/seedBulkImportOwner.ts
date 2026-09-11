// One-time (idempotent) setup: a dedicated system account that scraped-lead bulk uploads
// (bulk_upload_listings.py) post listings under, instead of a real user's account. Mirrors
// seedDemoListings.ts's "Seed Owner" pattern (upsert by phone, no OTP needed), but on the
// agentPro tier so its listing-slot cap (see ListingSlotsService.assertCanPublish) never blocks
// a real-sized batch — 50 units * 20 slots/unit = 1000 concurrent listings.
//
// Run: pnpm --filter @bhavano/bff prisma:seed:bulk-import-owner
// Prints the account's id — pass it to bulk_upload_listings.py's --owner-id.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const BULK_IMPORT_OWNER_PHONE = '9000000002';
// Comfortably beyond any reasonable batch size; re-run this script to extend if it's ever hit.
const AGENT_PRO_UNTIL = new Date('2099-01-01');
const AGENT_PRO_UNITS = 50;

async function main() {
  const owner = await prisma.user.upsert({
    where: { phone: BULK_IMPORT_OWNER_PHONE },
    update: { agentProUntil: AGENT_PRO_UNTIL, agentProUnits: AGENT_PRO_UNITS },
    create: {
      phone: BULK_IMPORT_OWNER_PHONE,
      name: 'Bulk Import (scraped leads)',
      phoneVerifiedAt: new Date(),
      agentProUntil: AGENT_PRO_UNTIL,
      agentProUnits: AGENT_PRO_UNITS,
    },
  });
  console.log(`Bulk-import owner ready — id: ${owner.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
