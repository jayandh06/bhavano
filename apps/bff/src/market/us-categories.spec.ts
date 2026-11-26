import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

// Condo, townhouse and room for rent are US-only (docs/plans/us-categories-condo-townhouse-room.md): the US stack accepts them when a listing is posted, the India stack does not.
function categoryErrors(market: string | undefined, category: string): number {
  const previous = process.env.MARKET;
  if (market === undefined) delete process.env.MARKET;
  else process.env.MARKET = market;
  let count = -1;
  try {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { CreateListingDto } = require('../listings/dto/create-listing.dto');
      const dto = plainToInstance(CreateListingDto, { category });
      count = validateSync(dto as object, { skipMissingProperties: true }).filter((e) => e.property === 'category').length;
    });
  } finally {
    if (previous === undefined) delete process.env.MARKET;
    else process.env.MARKET = previous;
  }
  return count;
}

describe('posting a listing in a new US category', () => {
  it.each(['condo', 'townhouse', 'room'])('accepts %s on the US stack', (category) => {
    expect(categoryErrors('us', category)).toBe(0);
  });

  it.each(['condo', 'townhouse', 'room'])('rejects %s on the India stack (and when no market is set)', (category) => {
    expect(categoryErrors('in', category)).toBeGreaterThan(0);
    expect(categoryErrors(undefined, category)).toBeGreaterThan(0);
  });

  it("still accepts India's own categories in India, and drops PG in the US", () => {
    for (const category of ['house', 'apartment', 'villa', 'pg', 'storage', 'coworking', 'furniture', 'interiors', 'plot', 'commercial']) {
      expect(categoryErrors('in', category)).toBe(0);
    }
    expect(categoryErrors('us', 'house')).toBe(0);
    expect(categoryErrors('us', 'pg')).toBeGreaterThan(0);
  });
});
