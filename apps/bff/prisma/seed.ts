import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { seedCities } from './seedCities';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const owner = await prisma.user.upsert({
    where: { phone: '9999999999' },
    update: {},
    create: { phone: '9999999999', name: 'Seed Owner', phoneVerifiedAt: new Date() },
  });

  const { cityRecords, areaRecords } = await seedCities(prisma);

  const blr = cityRecords.get('Bengaluru')!;
  const mum = cityRecords.get('Mumbai')!;
  const pune = cityRecords.get('Pune')!;
  const hyd = cityRecords.get('Hyderabad')!;

  const defaultExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const areaId = (cityName: string, areaName: string) => {
    const id = areaRecords.get(`${cityName}::${areaName}`);
    if (!id) throw new Error(`Seed area not found: ${cityName}::${areaName}`);
    return id;
  };

  // Demo listings only — never run this against production, unlike the city/area seed above.
  await prisma.listing.deleteMany({ where: { ownerId: owner.id } });

  await prisma.listing.createMany({
    data: [
      {
        category: 'apartment',
        transactionType: 'sell',
        price: 8500000,
        priceQualifier: 'onwards',
        title: '3 BHK Apartment in Koramangala',
        slug: '3-bhk-apartment-in-koramangala',
        areaId: areaId('Bengaluru', 'Koramangala'),
        cityId: blr,
        tag: 'FOR SALE',
        specs: ['3 Beds', '1450 sqft', '2 Bath'],
        attributes: { bedrooms: 3, sqft: 1450, furnished: 'semi' },
        ownerId: owner.id,
        expiresAt: defaultExpiresAt,
      },
      {
        category: 'house',
        transactionType: 'rent',
        price: 45000,
        priceQualifier: '/month',
        title: 'Independent House near IT Park',
        slug: 'independent-house-near-it-park',
        areaId: areaId('Bengaluru', 'Whitefield'),
        cityId: blr,
        tag: 'FOR RENT',
        specs: ['4 Beds', '2200 sqft'],
        attributes: { bedrooms: 4, sqft: 2200, furnished: 'furnished' },
        ownerId: owner.id,
        expiresAt: defaultExpiresAt,
      },
      {
        category: 'coworking',
        transactionType: 'rent',
        price: 6000,
        priceQualifier: '/seat/month',
        title: 'Premium Coworking Desks',
        slug: 'premium-coworking-desks',
        areaId: areaId('Bengaluru', 'Indiranagar'),
        cityId: blr,
        tag: 'COWORKING',
        specs: ['Hot desk', '24/7 access', 'Meeting rooms'],
        attributes: { seatType: 'hot-desk' },
        ownerId: owner.id,
        expiresAt: defaultExpiresAt,
      },
      {
        category: 'pg',
        transactionType: 'rent',
        price: 12000,
        priceQualifier: '/month',
        title: 'PG for Working Women',
        slug: 'pg-for-working-women',
        areaId: areaId('Bengaluru', 'HSR Layout'),
        cityId: blr,
        tag: 'PG · GIRLS',
        specs: ['Single occupancy', 'Food included'],
        attributes: { occupancy: 'single', gender: 'women' },
        ownerId: owner.id,
        expiresAt: defaultExpiresAt,
      },
      {
        category: 'furniture',
        transactionType: 'sell',
        price: 15000,
        priceQualifier: '',
        title: '3-Seater Fabric Sofa Set',
        slug: '3-seater-fabric-sofa-set',
        areaId: areaId('Bengaluru', 'Jayanagar'),
        cityId: blr,
        tag: 'FURNITURE',
        specs: ['Used - 1 year', 'Fabric'],
        condition: 'used',
        attributes: { material: 'fabric' },
        ownerId: owner.id,
        expiresAt: defaultExpiresAt,
      },
      {
        category: 'apartment',
        transactionType: 'rent',
        price: 55000,
        priceQualifier: '/month',
        title: '2 BHK Sea-Facing Apartment',
        slug: '2-bhk-sea-facing-apartment',
        areaId: areaId('Mumbai', 'Bandra'),
        cityId: mum,
        tag: 'FOR RENT',
        specs: ['2 Beds', '980 sqft'],
        attributes: { bedrooms: 2, sqft: 980, furnished: 'furnished' },
        ownerId: owner.id,
        expiresAt: defaultExpiresAt,
      },
      {
        category: 'apartment',
        transactionType: 'sell',
        price: 12500000,
        priceQualifier: 'onwards',
        title: '2 BHK Flat for Sale',
        slug: '2-bhk-flat-for-sale',
        areaId: areaId('Pune', 'Koregaon Park'),
        cityId: pune,
        tag: 'FOR SALE',
        specs: ['2 Beds', '1100 sqft'],
        attributes: { bedrooms: 2, sqft: 1100, furnished: 'unfurnished' },
        ownerId: owner.id,
        expiresAt: defaultExpiresAt,
      },
      {
        category: 'pg',
        transactionType: 'rent',
        price: 9000,
        priceQualifier: '/month',
        title: 'PG Near Hitech City',
        slug: 'pg-near-hitech-city',
        areaId: areaId('Hyderabad', 'Gachibowli'),
        cityId: hyd,
        tag: 'PG · CO-LIVING',
        specs: ['Double sharing', 'AC rooms'],
        attributes: { occupancy: 'double' },
        ownerId: owner.id,
        expiresAt: defaultExpiresAt,
      },
      {
        category: 'storage',
        transactionType: 'rent',
        price: 3000,
        priceQualifier: '/month',
        title: 'Secure Storage Unit',
        slug: 'secure-storage-unit',
        areaId: areaId('Bengaluru', 'Electronic City'),
        cityId: blr,
        tag: 'STORAGE',
        specs: ['100 sqft', 'CCTV monitored'],
        attributes: { sqft: 100 },
        ownerId: owner.id,
        expiresAt: defaultExpiresAt,
      },
      {
        category: 'furniture',
        transactionType: 'sell',
        price: 6000,
        priceQualifier: '',
        title: 'Queen Size Wooden Bed',
        slug: 'queen-size-wooden-bed',
        areaId: areaId('Pune', 'Baner'),
        cityId: pune,
        tag: 'FURNITURE',
        specs: ['New', 'Sheesham wood'],
        condition: 'new',
        attributes: { material: 'wood' },
        ownerId: owner.id,
        expiresAt: defaultExpiresAt,
      },
    ],
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
