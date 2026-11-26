import { US_CITY_STATE_CODES, citySlug } from '@bhavano/types/citySlug';
import { buildListingPath } from '@bhavano/types/listingPath';
import fs from 'fs';
import path from 'path';
import { loadUsCities, seedUsCities } from '../../prisma/seedUsCities';

const cities = loadUsCities();
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

describe('US launch cities', () => {
  it('are the 15 agreed, each with a state code for its URL', () => {
    expect(cities.map((c) => c.name).sort()).toEqual(Object.keys(US_CITY_STATE_CODES).sort());
    expect(cities).toHaveLength(15);
  });

  it('have unique neighbourhood names and URL segments, each within reach of its city', () => {
    for (const city of cities) {
      expect(city.areas.length).toBeGreaterThanOrEqual(10);
      const slugs = city.areas.map((a) => a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      expect(new Set(slugs).size).toBe(slugs.length);
      // A pin on a listed neighbourhood must file under this city, not outside every catchment.
      for (const area of city.areas) expect([city.name, area.name, km(city, area) <= city.catchmentKm]).toEqual([city.name, area.name, true]);
    }
  });

  it('do not overlap so much that one city centre sits inside another city', () => {
    for (const a of cities) for (const b of cities) if (a !== b) expect(km(a, b)).toBeGreaterThan(Math.max(a.catchmentKm, b.catchmentKm));
  });

  it('put the state in the US URL and leave India name-only', () => {
    expect(citySlug('Austin', 'us')).toBe('austin-tx');
    expect(citySlug('New York', 'us')).toBe('new-york-ny');
    expect(citySlug('Washington', 'us')).toBe('washington-dc');
    expect(citySlug('Austin', 'in')).toBe('austin');
    expect(citySlug('Delhi NCR', undefined)).toBe('delhi-ncr');
    expect(citySlug('Some Town', 'us')).toBe('some-town');
  });

  it('do not share a name with any India city, so no India URL can change', () => {
    const known = JSON.parse(fs.readFileSync(path.join(__dirname, '../../prisma/data/knownCities.json'), 'utf8')) as { name: string }[];
    const india = new Set(known.map((c) => c.name));
    expect(cities.filter((c) => india.has(c.name))).toEqual([]);
  });

  it('use the state slug in listing links on a US server only', () => {
    const item = { id: 'x1', slug: 'flat', category: 'condo' as const, transactionType: 'rent' as const, cityName: 'Austin', area: 'Hyde Park' };
    const before = { m: process.env.MARKET, p: process.env.NEXT_PUBLIC_MARKET };
    delete process.env.NEXT_PUBLIC_MARKET;
    process.env.MARKET = 'us';
    expect(buildListingPath(item)).toBe('/austin-tx/hyde-park/rent-lease/condo/flat-x1');
    delete process.env.MARKET;
    expect(buildListingPath(item)).toBe('/austin/hyde-park/rent-lease/condo/flat-x1');
    if (before.m !== undefined) process.env.MARKET = before.m;
    if (before.p !== undefined) process.env.NEXT_PUBLIC_MARKET = before.p;
  });

  it('refuses to seed anything but a US database', async () => {
    await expect(seedUsCities({} as never, 'in')).rejects.toThrow(/refuses to run/);
    await expect(seedUsCities({} as never, undefined)).rejects.toThrow(/refuses to run/);
  });
});
