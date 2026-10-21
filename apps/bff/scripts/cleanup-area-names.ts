/**
 * Cleans up the junk area names found by suspicious-areas.sql (addresses, pin codes, names typed in
 * lowercase, areas named after their own city). See docs/plans/area-page-indexing-and-name-cleanup.md.
 *
 *   node dist/scripts/cleanup-area-names.js            # prints the plan, changes nothing
 *   node dist/scripts/cleanup-area-names.js --apply    # does it, in one transaction
 *
 * Each entry below is one of:
 *  - rename: the area gets its proper name. If the city already has an area with that name
 *    (case-insensitive), the listings and every other reference are MOVED to it and the junk area
 *    is deleted, because (name, city) must be unique.
 *  - delete: only allowed when nothing points at the area. A delete that would orphan a listing
 *    or a requirement is refused, never forced.
 * A name that is not found is skipped, so re-running after a partial or full run is safe.
 *
 * Renaming an area changes the path of its listings. The listing page already 308-redirects any
 * older address to the current one by id, so shared links keep working.
 *
 * Left out on purpose: Ahmedabad "Near 100feet road, near torrent sub station" (the real locality
 * needs the listing's map pin), and the eight areas named after their city that still have listings
 * (Ahmedabad, Basirhat, Bengaluru, Coimbatore, Erode, Indore, Thiruvananthapuram, Vijayawada).
 * An area is required on a listing, and the city name is the honest fallback.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type Fix = { city: string; from: string } & ({ to: string } | { remove: true });

const FIXES: Fix[] = [
  // Address text -> the locality inside it (one listing each).
  { city: 'Bengaluru', from: 'Coconut Garden, Chaukya Nagar, Nagarbhavi', to: 'Nagarbhavi' },
  { city: 'Bengaluru', from: 'Sarjapur Main Road, Hadosiddapura, Carmelaram, Chikkakannalli', to: 'Carmelaram' },
  { city: 'Bengaluru', from: 'kodihalli, Hoskote', to: 'Kodihalli' },
  { city: 'Coimbatore', from: 'PMG Nagar - Prasanna Maha Ganapathy Nagar - INDESPA PROPERTIES', to: 'PMG Nagar' },
  { city: 'Delhi NCR', from: 'Amrapali Dream vallie phase II noida extension', to: 'Noida Extension' },
  { city: 'Delhi NCR', from: 'c block ,sector 43 gurgaon', to: 'Sector 43' },
  { city: 'Delhi NCR', from: 'sector 23', to: 'Sector 23' },
  { city: 'Mathura', from: 'Govardhan Chatta Road  Kunjera  PO Radhakund  Pin  281504', to: 'Kunjera' },
  { city: 'Rajapalayam', from: "Raju's College Opposite, Melapalayam", to: 'Melapalayam' },
  { city: 'Rishikesh', from: 'Shiv vihar gali no.1 gumaniwala shyampur Rishikesh', to: 'Shyampur' },
  { city: 'Thiruvananthapuram', from: 'kizharoor, ambalathinkala', to: 'Kizharoor' },
  { city: 'Vijayawada', from: 'vidhyadharapuram, near ajit singh nagar', to: 'Vidhyadharapuram' },

  // Right name, wrong capitalisation.
  { city: 'Chennai', from: 'mangalambigai nagar', to: 'Mangalambigai Nagar' },
  { city: 'Delhi NCR', from: 'vrindavan', to: 'Vrindavan' },
  { city: 'Lucknow', from: 'kurasi road', to: 'Kurasi Road' },
  { city: 'Bengaluru', from: 'puttathimanahalli', to: 'Puttathimanahalli' },
  { city: 'Chennai', from: 'vazhuthalambedu', to: 'Vazhuthalambedu' },
  { city: 'Coimbatore', from: 'kumarapuram', to: 'Kumarapuram' },
  { city: 'Coimbatore', from: 'pai nagar', to: 'Pai Nagar' },
  { city: 'Kanpur', from: 'babu puram', to: 'Babu Puram' },

  // A gated community picked up from the map pin instead of the locality it sits in. Check the
  // dry-run count first: every listing under "Green Villas" moves to Halanayakanahalli.
  { city: 'Bengaluru', from: 'Green Villas', to: 'Halanayakanahalli' },

  // Junk with nothing pointing at it.
  { city: 'Bengaluru', from: 'taluk', remove: true },
  { city: 'Madurai', from: 'NEAR', remove: true },
  { city: 'Kolkata', from: 'https://maps.app.goo.gl/91zcDPiV53FdMejy9?g_st=aw', remove: true },
  { city: 'Guwahati', from: 'Near Pani Tanki More (Clock Tower)', remove: true },
  { city: 'Hisar', from: 'Guru Jambheshwar University of Science and Technology', remove: true },
  { city: 'Dehradun', from: 'Shiv vihar gali no.1 gumaniwala shyampur Rishikesh', remove: true },
  { city: 'Delhi NCR', from: 'Bhagwan Buddha Housing Corporation Society', remove: true },
  { city: 'Pune', from: 'Akashvani Rashtriya Film Sangrahalay Quarters', remove: true },
  // Named after their own city, no listings.
  { city: 'Bhubaneswar', from: 'Bhubaneswar', remove: true },
  { city: 'Jaipur', from: 'Jaipur', remove: true },
  { city: 'Raipur', from: 'Raipur', remove: true },
  { city: 'Ranchi', from: 'Ranchi', remove: true },
  { city: 'Vadodara', from: 'Vadodara', remove: true },
];

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  console.log(apply ? '[APPLY]' : '[DRY RUN: nothing is changed]');
  let changed = 0;
  let skipped = 0;
  let refused = 0;

  for (const fix of FIXES) {
    const label = `${fix.city} / "${fix.from}"`;
    const area = await prisma.area.findFirst({ where: { name: fix.from, city: { name: fix.city } } });
    if (!area) {
      console.log(`skip     ${label}: not found (already done?)`);
      skipped++;
      continue;
    }
    const refs = {
      listings: await prisma.listing.count({ where: { areaId: area.id } }),
      requirements: await prisma.requirement.count({ where: { areaId: area.id } }),
      outreach: await prisma.outreachContact.count({ where: { areaId: area.id } }),
      places: await prisma.placesFetchLog.count({ where: { areaId: area.id } }),
    };
    const inUse = Object.values(refs).some((n) => n > 0);
    const summary = `listings ${refs.listings}, requirements ${refs.requirements}, outreach ${refs.outreach}, places logs ${refs.places}`;

    if ('remove' in fix) {
      if (inUse) {
        console.log(`REFUSED  delete ${label}: still referenced (${summary})`);
        refused++;
        continue;
      }
      console.log(`delete   ${label} (${summary})`);
      if (apply) await prisma.area.delete({ where: { id: area.id } });
      changed++;
      continue;
    }

    const existing = await prisma.area.findFirst({
      where: { cityId: area.cityId, name: { equals: fix.to, mode: 'insensitive' }, NOT: { id: area.id } },
    });
    if (!existing) {
      console.log(`rename   ${label} -> "${fix.to}" (${summary})`);
      if (apply) await prisma.area.update({ where: { id: area.id }, data: { name: fix.to } });
      changed++;
      continue;
    }

    console.log(`merge    ${label} -> existing "${existing.name}" (${summary})`);
    if (apply) {
      await prisma.$transaction([
        prisma.listing.updateMany({ where: { areaId: area.id }, data: { areaId: existing.id } }),
        prisma.requirement.updateMany({ where: { areaId: area.id }, data: { areaId: existing.id } }),
        prisma.outreachContact.updateMany({ where: { areaId: area.id }, data: { areaId: existing.id } }),
        prisma.placesFetchLog.updateMany({ where: { areaId: area.id }, data: { areaId: existing.id } }),
        // The id arrays have no foreign key, so they are rewritten by hand.
        prisma.$executeRaw`UPDATE "SavedSearch" SET "areaIds" = array_replace("areaIds", ${area.id}, ${existing.id}) WHERE ${area.id} = ANY("areaIds")`,
        prisma.$executeRaw`UPDATE "Requirement" SET "areaIds" = array_replace("areaIds", ${area.id}, ${existing.id}) WHERE ${area.id} = ANY("areaIds")`,
        prisma.$executeRaw`UPDATE "SearchEvent" SET "areaIds" = array_replace("areaIds", ${area.id}, ${existing.id}) WHERE ${area.id} = ANY("areaIds")`,
        prisma.area.delete({ where: { id: area.id } }),
      ]);
    }
    changed++;
  }

  console.log(`\n${apply ? 'Done' : 'Plan'}: ${changed} ${apply ? 'changed' : 'to change'}, ${skipped} not found, ${refused} refused.`);
}

main().finally(() => prisma.$disconnect());
