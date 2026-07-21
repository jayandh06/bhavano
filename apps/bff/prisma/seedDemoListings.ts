// Bulk demo data: at least three listings for every valid (category, transactionType) pair in
// every seeded city, each with a real, renderable photo. Kept separate from `seed.ts` (which
// stays a small hand-written fixture set) and owned by its own user, so the two never clobber
// each other and this one is independently re-runnable.
//
// See docs/plans/seed-full-listing-matrix.md.
import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient, type ListingCategory, type TransactionType } from '@prisma/client';
import sharp from 'sharp';
import { POSTABLE_TRANSACTION_TYPES } from '@bhavano/types/postingRules';
import { PRICE_BOUNDS } from '@bhavano/types/priceBounds';
import { getPriceQualifierOptions } from '@bhavano/types/priceQualifiers';
import { deriveTag } from '@bhavano/types/listingTag';
import { slugify } from '@bhavano/types/slugify';
import { PHOTO_VARIANTS, variantKey, type PhotoVariant } from '../src/uploads/photo-keys';
import { seedCities } from './seedCities';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO_OWNER_PHONE = '9000000001';
const RECORDS_PER_COMBO = 3;
const LISTING_DURATION_DAYS = 30;

/** With CDN_BASE_URL unset locally, `variantUrl()` emits a root-relative "/photos/..." path,
 * which Next serves straight out of the web app's public dir — so that's where the generated
 * files go. (For mobile testing, point CDN_BASE_URL at the LAN address instead.) */
const PHOTO_DIR = path.resolve(__dirname, '../../web/public/photos');

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

const CATEGORY_STYLE: Record<ListingCategory, { label: string; bg: string; fg: string }> = {
  house: { label: 'House', bg: '#1f6f54', fg: '#eafaf2' },
  apartment: { label: 'Apartment', bg: '#1d5b8f', fg: '#e8f2fb' },
  villa: { label: 'Villa', bg: '#2f6b4f', fg: '#eaf7ef' },
  pg: { label: 'PG / Co-living', bg: '#8a4b1f', fg: '#fdf0e6' },
  storage: { label: 'Storage', bg: '#4a4f57', fg: '#f0f2f5' },
  coworking: { label: 'Coworking', bg: '#5a3a86', fg: '#f2ecfb' },
  furniture: { label: 'Furniture', bg: '#8f6b1d', fg: '#fbf5e6' },
  interiors: { label: 'Interiors', bg: '#8f2f4b', fg: '#fbe9ef' },
  plot: { label: 'Plot / Land', bg: '#6b5a2f', fg: '#f7f2e6' },
  commercial: { label: 'Commercial Space', bg: '#37505f', fg: '#e9f2f5' },
};

/** 64-bit difference-hash — mirrors `computeDHash` in uploads.controller.ts so the stored hash
 * is the same shape a real upload would have produced. (Duplicated rather than imported: that
 * file is a Nest controller and importing it would drag in the DI graph.) */
async function computeDHash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let row = 0; row < info.height; row++) {
    for (let col = 0; col < info.width - 1; col++) {
      bits += data[row * info.width + col] < data[row * info.width + col + 1] ? '1' : '0';
    }
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}

async function renderVariant(category: ListingCategory, variant: PhotoVariant): Promise<Buffer> {
  const { width, quality } = PHOTO_VARIANTS[variant];
  const height = Math.round(width * 0.75);
  const { label, bg, fg } = CATEGORY_STYLE[category];
  const titleSize = Math.round(width * 0.09);
  const subSize = Math.round(width * 0.04);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <rect x="${width * 0.06}" y="${height * 0.06}" width="${width * 0.88}" height="${height * 0.88}"
          fill="none" stroke="${fg}" stroke-opacity="0.35" stroke-width="${Math.max(2, width * 0.004)}"/>
    <text x="50%" y="49%" text-anchor="middle" fill="${fg}"
          font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="700">${label}</text>
    <text x="50%" y="62%" text-anchor="middle" fill="${fg}" fill-opacity="0.7"
          font-family="Helvetica, Arial, sans-serif" font-size="${subSize}">Bhavano demo photo</text>
  </svg>`;

  return sharp(Buffer.from(svg)).webp({ quality }).toBuffer();
}

interface CategoryImage {
  buffers: Record<PhotoVariant, Buffer>;
  hash: string;
}

/** Encoded once per category (14 encodes total) and then file-copied per listing — re-encoding
 * ~3,000 files would dominate the runtime, copying bytes is effectively free. */
async function buildCategoryImages(): Promise<Record<ListingCategory, CategoryImage>> {
  const variants = Object.keys(PHOTO_VARIANTS) as PhotoVariant[];
  const entries = await Promise.all(
    (Object.keys(CATEGORY_STYLE) as ListingCategory[]).map(async (category) => {
      const buffers = {} as Record<PhotoVariant, Buffer>;
      for (const variant of variants) buffers[variant] = await renderVariant(category, variant);
      return [category, { buffers, hash: await computeDHash(buffers.full) }] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<ListingCategory, CategoryImage>;
}

// ---------------------------------------------------------------------------
// Field derivation
// ---------------------------------------------------------------------------

const isSale = (t: TransactionType) => t === 'sell' || t === 'buy';

/** Geometric interpolation between the category's plausibility bounds. Linear interpolation
 * would be useless here — the bands span several orders of magnitude (a flat 5% of
 * 1L–50Cr is still 2.5Cr), whereas geometric spacing lands on realistic asking prices and
 * spreads the three records across different BrowseFilterBar quick-pick brackets. */
function priceFor(category: ListingCategory, transactionType: TransactionType, index: number): number {
  const { min, max } = PRICE_BOUNDS[category][isSale(transactionType) ? 'sale' : 'rental'];
  const fraction = [0.4, 0.5, 0.6][index];
  const raw = min * Math.pow(max / min, fraction);
  const step = raw > 100_000 ? 10_000 : raw > 10_000 ? 500 : 50;
  return Math.round(raw / step) * step;
}

const SALE_WORD: Record<TransactionType, string> = {
  buy: 'for Sale',
  sell: 'for Sale',
  rent: 'for Rent',
  lease: 'on Lease',
};

const FURNITURE_ITEMS = ['3-Seater Fabric Sofa', 'Queen Size Wooden Bed', '6-Seater Dining Table'];
const INTERIOR_SERVICES = [
  { value: 'modular-kitchen', title: 'Modular Kitchen Design' },
  { value: 'wardrobe', title: 'Custom Wardrobe Installation' },
  { value: 'full-home', title: 'Full Home Interior Package' },
];
const SHARING = ['single', 'double', 'triple'];
const GENDERS = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'coed', label: 'Co-ed' },
];
const SEAT_TYPES = [
  { value: 'hot-desk', label: 'Hot Desk' },
  { value: 'dedicated-desk', label: 'Dedicated Desk' },
  { value: 'private-cabin', label: 'Private Cabin' },
];

interface Derived {
  title: string;
  specs: string[];
  attributes: Record<string, unknown>;
  condition?: 'new' | 'used';
}

/** Every `required: true` field in CATEGORY_FIELD_CONFIG is filled; optional ones are varied
 * across the three records so the facet filters have an actual distribution to bite on. */
function deriveFields(category: ListingCategory, transactionType: TransactionType, areaName: string, i: number): Derived {
  const suffix = SALE_WORD[transactionType];

  switch (category) {
    case 'house':
    case 'apartment':
    case 'villa': {
      const bedrooms = [2, 3, 4][i];
      const bathrooms = [2, 2, 3][i];
      const sqft = [950, 1450, 2200][i];
      const furnished = ['unfurnished', 'semi', 'furnished'][i];
      const noun = category === 'house' ? 'Independent House' : category === 'apartment' ? 'Apartment' : 'Villa';
      return {
        title: `${bedrooms} BHK ${noun} ${suffix} in ${areaName}`,
        specs: [`${bedrooms} Beds`, `${bathrooms} Bath`, `${sqft} sqft`],
        attributes: { bedrooms, bathrooms, sqft, furnished },
      };
    }
    case 'pg': {
      const sharingType = SHARING[i];
      const gender = GENDERS[i];
      const meals = ['yes', 'no', 'yes'][i];
      return {
        title: `PG for ${gender.label} in ${areaName}`,
        specs: [`${sharingType} occupancy`, meals === 'yes' ? 'Meals included' : 'No meals'],
        attributes: { sharingType, gender: gender.value, meals },
      };
    }
    case 'storage': {
      const sizeSqft = [50, 120, 300][i];
      const accessHours = ['24x7', 'business', '24x7'][i];
      return {
        title: `${sizeSqft} sqft Storage Unit ${suffix} in ${areaName}`,
        specs: [`${sizeSqft} sqft`, accessHours === '24x7' ? '24/7 access' : 'Business hours'],
        attributes: { sizeSqft, accessHours },
      };
    }
    case 'coworking': {
      const seat = SEAT_TYPES[i];
      return {
        title: `${seat.label} Coworking Space ${suffix} in ${areaName}`,
        specs: [seat.label, '24/7 access', 'Meeting rooms'],
        attributes: { seatType: seat.value, amenities: 'High-speed wifi, meeting rooms, pantry' },
      };
    }
    case 'furniture': {
      const condition = (['used', 'new', 'used'] as const)[i];
      const material = ['fabric', 'wood', 'metal'][i];
      return {
        title: `${FURNITURE_ITEMS[i]} ${suffix} in ${areaName}`,
        specs: [condition === 'new' ? 'New' : 'Used - 1 year', material],
        attributes: { material, condition, dimensions: '72in x 36in x 30in' },
        condition,
      };
    }
    case 'interiors': {
      const service = INTERIOR_SERVICES[i];
      return {
        title: `${service.title} in ${areaName}`,
        specs: ['Design + installation', '10-year warranty'],
        attributes: { serviceType: service.value },
      };
    }
    case 'plot': {
      const plotAreaSqft = [1200, 2400, 4800][i];
      const facing = ['east', 'north', 'north-east'][i];
      const boundaryWall = (['yes', 'yes', 'no'] as const)[i];
      return {
        title: `${plotAreaSqft} sqft Plot ${suffix} in ${areaName}`,
        specs: [`${plotAreaSqft} sqft`, `${facing} facing`, boundaryWall === 'yes' ? 'Boundary wall' : 'Open plot'],
        attributes: { plotAreaSqft, facing, boundaryWall, approvedBy: 'BDA' },
      };
    }
    case 'commercial': {
      const PURPOSES = [
        { value: 'office', label: 'Office Space' },
        { value: 'retail', label: 'Retail Space' },
        { value: 'warehouse', label: 'Warehouse' },
      ];
      const purpose = PURPOSES[i];
      const sqft = [500, 1200, 3000][i];
      const floor = ['Ground floor', '2nd floor', 'Ground floor'][i];
      return {
        title: `${purpose.label} ${suffix} in ${areaName}`,
        specs: [`${sqft} sqft`, purpose.label, floor],
        attributes: { sqft, purpose: purpose.value, floor },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const owner = await prisma.user.upsert({
    where: { phone: DEMO_OWNER_PHONE },
    update: {},
    create: { phone: DEMO_OWNER_PHONE, name: 'Demo Seed Owner', phoneVerifiedAt: new Date() },
  });

  await seedCities(prisma);

  // Idempotency: drop this owner's previous run (photos cascade) and delete only the image
  // files belonging to those exact listing ids, leaving anything else in the dir untouched.
  const previous = await prisma.listing.findMany({ where: { ownerId: owner.id }, select: { id: true } });
  if (previous.length > 0) {
    await prisma.listing.deleteMany({ where: { ownerId: owner.id } });
    const stale = new Set(previous.map((l) => l.id));
    const existing = await fs.readdir(PHOTO_DIR).catch(() => [] as string[]);
    await Promise.all(
      existing.filter((f) => stale.has(f.split('_')[0])).map((f) => fs.unlink(path.join(PHOTO_DIR, f))),
    );
    console.log(`Cleared ${previous.length} listings from the previous run.`);
  }

  await fs.mkdir(PHOTO_DIR, { recursive: true });
  const images = await buildCategoryImages();
  console.log('Generated category base images.');

  const cities = await prisma.city.findMany({ include: { areas: true }, orderBy: { name: 'asc' } });
  const combos = (Object.keys(POSTABLE_TRANSACTION_TYPES) as ListingCategory[]).flatMap((category) =>
    POSTABLE_TRANSACTION_TYPES[category].map((transactionType) => ({ category, transactionType })),
  );
  const expiresAt = new Date(Date.now() + LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const variants = Object.keys(PHOTO_VARIANTS) as PhotoVariant[];

  let totalListings = 0;
  let totalFiles = 0;

  for (const city of cities) {
    if (city.areas.length === 0) {
      console.warn(`Skipping ${city.name} — no areas seeded.`);
      continue;
    }

    const rows = combos.flatMap((combo, comboIndex) =>
      Array.from({ length: RECORDS_PER_COMBO }, (_, i) => {
        // Rotate through the city's areas so listings spread across localities, which also
        // gives the area filter something real to narrow.
        const area = city.areas[(comboIndex * RECORDS_PER_COMBO + i) % city.areas.length];
        const derived = deriveFields(combo.category, combo.transactionType, area.name, i);
        const qualifiers = getPriceQualifierOptions(combo.category, combo.transactionType);
        return {
          category: combo.category,
          transactionType: combo.transactionType,
          price: priceFor(combo.category, combo.transactionType, i),
          priceQualifier: qualifiers[0]?.value ?? '',
          title: derived.title,
          slug: slugify(derived.title),
          areaId: area.id,
          cityId: city.id,
          lat: area.lat,
          lng: area.lng,
          tag: deriveTag(combo),
          specs: derived.specs,
          attributes: derived.attributes as Prisma.InputJsonValue,
          condition: derived.condition,
          ownerId: owner.id,
          expiresAt,
        };
      }),
    );

    const created = await prisma.listing.createManyAndReturn({
      data: rows,
      select: { id: true, category: true },
    });

    await prisma.listingPhoto.createMany({
      data: created.map((l) => ({ listingId: l.id, photoNo: 1, hash: images[l.category].hash })),
    });

    await Promise.all(
      created.flatMap((l) =>
        variants.map((variant) =>
          fs.writeFile(
            // Built from the real key helper, so the files on disk can't drift from the URL
            // the DTO derives.
            path.join(PHOTO_DIR, path.basename(variantKey(l.id, 1, variant))),
            images[l.category].buffers[variant],
          ),
        ),
      ),
    );

    totalListings += created.length;
    totalFiles += created.length * variants.length;
    console.log(`${city.name}: ${created.length} listings`);
  }

  console.log(`\nDone — ${totalListings} listings across ${cities.length} cities, ${totalFiles} photo files.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
