import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const cities = [
  { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, isPopular: true },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.8777, isPopular: true },
  { name: 'Delhi NCR', state: 'Delhi', lat: 28.7041, lng: 77.1025, isPopular: true },
  { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, isPopular: true },
  { name: 'Hyderabad', state: 'Telangana', lat: 17.385, lng: 78.4867, isPopular: true },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, isPopular: true },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, isPopular: true },
  { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714, isPopular: true },
];

// Curated list of well-known real localities per city (approximate lat/lng), sourced from
// general knowledge rather than a downloaded dataset — good coverage of major areas, not
// exhaustive. New areas typed by users on the post-ad form are added alongside these.
const areasByCity: Record<string, { name: string; lat: number; lng: number }[]> = {
  Bengaluru: [
    { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
    { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
    { name: 'Whitefield', lat: 12.9698, lng: 77.75 },
    { name: 'HSR Layout', lat: 12.9121, lng: 77.6446 },
    { name: 'Jayanagar', lat: 12.925, lng: 77.5938 },
    { name: 'JP Nagar', lat: 12.9077, lng: 77.5851 },
    { name: 'Electronic City', lat: 12.8452, lng: 77.6602 },
    { name: 'Marathahalli', lat: 12.9569, lng: 77.6974 },
    { name: 'BTM Layout', lat: 12.9166, lng: 77.6101 },
    { name: 'Bannerghatta Road', lat: 12.8933, lng: 77.5972 },
    { name: 'Yelahanka', lat: 13.1007, lng: 77.5963 },
    { name: 'Hebbal', lat: 13.0355, lng: 77.597 },
    { name: 'Malleswaram', lat: 13.0035, lng: 77.5697 },
    { name: 'Rajajinagar', lat: 12.9915, lng: 77.5528 },
    { name: 'Basavanagudi', lat: 12.9422, lng: 77.576 },
    { name: 'MG Road', lat: 12.9758, lng: 77.6045 },
    { name: 'Sarjapur Road', lat: 12.901, lng: 77.6874 },
    { name: 'Bellandur', lat: 12.9257, lng: 77.6779 },
    { name: 'Hennur', lat: 13.0357, lng: 77.6408 },
    { name: 'RT Nagar', lat: 13.0201, lng: 77.5937 },
  ],
  Mumbai: [
    { name: 'Bandra', lat: 19.0596, lng: 72.8295 },
    { name: 'Andheri', lat: 19.1136, lng: 72.8697 },
    { name: 'Juhu', lat: 19.1075, lng: 72.8263 },
    { name: 'Powai', lat: 19.1176, lng: 72.906 },
    { name: 'Malad', lat: 19.1875, lng: 72.8484 },
    { name: 'Borivali', lat: 19.2307, lng: 72.8567 },
    { name: 'Dadar', lat: 19.0178, lng: 72.8478 },
    { name: 'Worli', lat: 19.0176, lng: 72.8162 },
    { name: 'Colaba', lat: 18.9067, lng: 72.8147 },
    { name: 'Chembur', lat: 19.0522, lng: 72.9005 },
    { name: 'Ghatkopar', lat: 19.0863, lng: 72.9081 },
    { name: 'Vikhroli', lat: 19.1075, lng: 72.9256 },
    { name: 'Kandivali', lat: 19.2094, lng: 72.8526 },
    { name: 'Goregaon', lat: 19.1663, lng: 72.8526 },
    { name: 'Mulund', lat: 19.1726, lng: 72.9425 },
    { name: 'Vashi', lat: 19.0771, lng: 72.9986 },
    { name: 'Kharghar', lat: 19.0474, lng: 73.0645 },
    { name: 'Lower Parel', lat: 18.9967, lng: 72.83 },
    { name: 'Thane', lat: 19.2183, lng: 72.9781 },
    { name: 'Santacruz', lat: 19.0821, lng: 72.8416 },
  ],
  'Delhi NCR': [
    { name: 'Connaught Place', lat: 28.6315, lng: 77.2167 },
    { name: 'Dwarka', lat: 28.5921, lng: 77.046 },
    { name: 'Rohini', lat: 28.7495, lng: 77.0565 },
    { name: 'Saket', lat: 28.5245, lng: 77.2066 },
    { name: 'Vasant Kunj', lat: 28.52, lng: 77.159 },
    { name: 'Karol Bagh', lat: 28.6519, lng: 77.1909 },
    { name: 'Lajpat Nagar', lat: 28.5677, lng: 77.2434 },
    { name: 'Hauz Khas', lat: 28.5494, lng: 77.2001 },
    { name: 'Gurugram Cyber City', lat: 28.4949, lng: 77.089 },
    { name: 'Noida Sector 62', lat: 28.6139, lng: 77.3728 },
    { name: 'Greater Kailash', lat: 28.5494, lng: 77.2425 },
    { name: 'Pitampura', lat: 28.7041, lng: 77.1318 },
    { name: 'Janakpuri', lat: 28.6219, lng: 77.0827 },
    { name: 'Mayur Vihar', lat: 28.6096, lng: 77.2953 },
    { name: 'Faridabad', lat: 28.4089, lng: 77.3178 },
    { name: 'Vasundhara', lat: 28.6603, lng: 77.3565 },
    { name: 'Indirapuram', lat: 28.6462, lng: 77.372 },
    { name: 'Chattarpur', lat: 28.4986, lng: 77.1748 },
    { name: 'Kalkaji', lat: 28.5384, lng: 77.2585 },
    { name: 'Rajouri Garden', lat: 28.6465, lng: 77.12 },
  ],
  Pune: [
    { name: 'Koregaon Park', lat: 18.5362, lng: 73.8938 },
    { name: 'Baner', lat: 18.559, lng: 73.7868 },
    { name: 'Kothrud', lat: 18.5074, lng: 73.8077 },
    { name: 'Hinjewadi', lat: 18.5908, lng: 73.7389 },
    { name: 'Viman Nagar', lat: 18.5679, lng: 73.9143 },
    { name: 'Aundh', lat: 18.559, lng: 73.8077 },
    { name: 'Wakad', lat: 18.598, lng: 73.7629 },
    { name: 'Hadapsar', lat: 18.5089, lng: 73.926 },
    { name: 'Kharadi', lat: 18.5515, lng: 73.943 },
    { name: 'Shivaji Nagar', lat: 18.5308, lng: 73.8474 },
    { name: 'Pune Camp', lat: 18.5122, lng: 73.8797 },
    { name: 'Deccan Gymkhana', lat: 18.5158, lng: 73.8412 },
    { name: 'Magarpatta', lat: 18.5158, lng: 73.928 },
    { name: 'Pimpri-Chinchwad', lat: 18.6298, lng: 73.7997 },
    { name: 'Katraj', lat: 18.4575, lng: 73.8673 },
    { name: 'Warje', lat: 18.4783, lng: 73.8081 },
    { name: 'Bavdhan', lat: 18.5089, lng: 73.7739 },
    { name: 'Undri', lat: 18.4457, lng: 73.9247 },
    { name: 'NIBM Road', lat: 18.4667, lng: 73.9127 },
    { name: 'Yerwada', lat: 18.5479, lng: 73.8823 },
  ],
  Hyderabad: [
    { name: 'Banjara Hills', lat: 17.4156, lng: 78.4347 },
    { name: 'Jubilee Hills', lat: 17.4325, lng: 78.4071 },
    { name: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
    { name: 'Hitech City', lat: 17.4483, lng: 78.3915 },
    { name: 'Madhapur', lat: 17.4483, lng: 78.3915 },
    { name: 'Kondapur', lat: 17.4615, lng: 78.3634 },
    { name: 'Kukatpally', lat: 17.4849, lng: 78.4108 },
    { name: 'Secunderabad', lat: 17.4399, lng: 78.4983 },
    { name: 'Ameerpet', lat: 17.4374, lng: 78.4482 },
    { name: 'Begumpet', lat: 17.44, lng: 78.4661 },
    { name: 'Miyapur', lat: 17.4966, lng: 78.3606 },
    { name: 'LB Nagar', lat: 17.3466, lng: 78.5522 },
    { name: 'Uppal', lat: 17.4058, lng: 78.559 },
    { name: 'Dilsukhnagar', lat: 17.3687, lng: 78.5247 },
    { name: 'Manikonda', lat: 17.4021, lng: 78.3841 },
    { name: 'Nallagandla', lat: 17.4602, lng: 78.3179 },
    { name: 'Attapur', lat: 17.3667, lng: 78.4275 },
    { name: 'Malakpet', lat: 17.3745, lng: 78.4989 },
    { name: 'Kompally', lat: 17.5406, lng: 78.4894 },
    { name: 'Tellapur', lat: 17.4581, lng: 78.2814 },
  ],
  Chennai: [
    { name: 'T Nagar', lat: 13.0418, lng: 80.2341 },
    { name: 'Adyar', lat: 13.0067, lng: 80.257 },
    { name: 'Anna Nagar', lat: 13.085, lng: 80.2101 },
    { name: 'Velachery', lat: 12.9791, lng: 80.2183 },
    { name: 'Nungambakkam', lat: 13.0569, lng: 80.2425 },
    { name: 'Mylapore', lat: 13.0339, lng: 80.2697 },
    { name: 'Besant Nagar', lat: 12.999, lng: 80.2668 },
    { name: 'Porur', lat: 13.0382, lng: 80.1565 },
    { name: 'Sholinganallur', lat: 12.901, lng: 80.2279 },
    { name: 'Guindy', lat: 13.0067, lng: 80.2206 },
    { name: 'Tambaram', lat: 12.9249, lng: 80.1 },
    { name: 'Perungudi', lat: 12.9634, lng: 80.2422 },
    { name: 'Kilpauk', lat: 13.0764, lng: 80.2385 },
    { name: 'Egmore', lat: 13.0732, lng: 80.2609 },
    { name: 'Alwarpet', lat: 13.0339, lng: 80.254 },
    { name: 'Ambattur', lat: 13.1143, lng: 80.1548 },
    { name: 'Chromepet', lat: 12.9516, lng: 80.1391 },
    { name: 'Vadapalani', lat: 13.0503, lng: 80.2121 },
    { name: 'Thoraipakkam', lat: 12.9407, lng: 80.2372 },
    { name: 'Royapettah', lat: 13.053, lng: 80.265 },
  ],
  Kolkata: [
    { name: 'Park Street', lat: 22.5535, lng: 88.3524 },
    { name: 'Salt Lake', lat: 22.5793, lng: 88.4173 },
    { name: 'Ballygunge', lat: 22.5271, lng: 88.3654 },
    { name: 'Alipore', lat: 22.5266, lng: 88.3316 },
    { name: 'New Town', lat: 22.5809, lng: 88.4784 },
    { name: 'Behala', lat: 22.5, lng: 88.3167 },
    { name: 'Howrah', lat: 22.5958, lng: 88.2636 },
    { name: 'Rajarhat', lat: 22.616, lng: 88.4637 },
    { name: 'Garia', lat: 22.4611, lng: 88.3928 },
    { name: 'Dum Dum', lat: 22.642, lng: 88.4197 },
    { name: 'Jadavpur', lat: 22.499, lng: 88.3714 },
    { name: 'Tollygunge', lat: 22.5028, lng: 88.3467 },
    { name: 'Gariahat', lat: 22.5186, lng: 88.3671 },
    { name: 'Esplanade', lat: 22.5626, lng: 88.3512 },
    { name: 'Shyambazar', lat: 22.599, lng: 88.373 },
    { name: 'Kasba', lat: 22.5177, lng: 88.3866 },
    { name: 'BT Road', lat: 22.6539, lng: 88.3745 },
    { name: 'Ultadanga', lat: 22.5967, lng: 88.3901 },
    { name: 'Lake Town', lat: 22.61, lng: 88.4051 },
    { name: 'Kalighat', lat: 22.5192, lng: 88.3427 },
  ],
  Ahmedabad: [
    { name: 'Satellite', lat: 23.0225, lng: 72.515 },
    { name: 'Navrangpura', lat: 23.0359, lng: 72.5602 },
    { name: 'Bodakdev', lat: 23.0396, lng: 72.506 },
    { name: 'Vastrapur', lat: 23.0396, lng: 72.529 },
    { name: 'Prahlad Nagar', lat: 23.0088, lng: 72.5049 },
    { name: 'Maninagar', lat: 22.9963, lng: 72.6027 },
    { name: 'Bopal', lat: 23.0325, lng: 72.4694 },
    { name: 'SG Highway', lat: 23.03, lng: 72.51 },
    { name: 'CG Road', lat: 23.0332, lng: 72.56 },
    { name: 'Paldi', lat: 23.0125, lng: 72.5622 },
    { name: 'Vastral', lat: 22.9937, lng: 72.657 },
    { name: 'Chandkheda', lat: 23.1122, lng: 72.594 },
    { name: 'Thaltej', lat: 23.0489, lng: 72.5069 },
    { name: 'Naranpura', lat: 23.049, lng: 72.557 },
    { name: 'Ghatlodia', lat: 23.068, lng: 72.5385 },
    { name: 'Nikol', lat: 23.0333, lng: 72.65 },
    { name: 'Vejalpur', lat: 22.991, lng: 72.521 },
    { name: 'Ellisbridge', lat: 23.0225, lng: 72.561 },
    { name: 'Shahibaug', lat: 23.0468, lng: 72.5989 },
    { name: 'Ranip', lat: 23.0805, lng: 72.5726 },
  ],
};

async function main() {
  const owner = await prisma.user.upsert({
    where: { phone: '9999999999' },
    update: {},
    create: { phone: '9999999999', name: 'Seed Owner', phoneVerifiedAt: new Date() },
  });

  const cityRecords = new Map<string, string>();
  for (const c of cities) {
    const city = await prisma.city.upsert({
      where: { name_state: { name: c.name, state: c.state } },
      update: c,
      create: c,
    });
    cityRecords.set(c.name, city.id);
  }

  const areaRecords = new Map<string, string>();
  for (const [cityName, areas] of Object.entries(areasByCity)) {
    const cityId = cityRecords.get(cityName)!;
    for (const a of areas) {
      const area = await prisma.area.upsert({
        where: { name_cityId: { name: a.name, cityId } },
        update: { lat: a.lat, lng: a.lng, source: 'curated' },
        create: { name: a.name, cityId, lat: a.lat, lng: a.lng, source: 'curated' },
      });
      areaRecords.set(`${cityName}::${a.name}`, area.id);
    }
  }

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
