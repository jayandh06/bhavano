import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListAdminListingsDto } from './list-admin-listings.dto';

const errorsFor = (query: Record<string, string>) => validateSync(plainToInstance(ListAdminListingsDto, query));

describe('ListAdminListingsDto — publishState filter', () => {
  it.each(['live', 'pending_checkout', 'awaiting_claim', 'scheduled'])('accepts %s (every state the admin tabs filter on)', (state) => {
    expect(errorsFor({ publishState: state })).toHaveLength(0);
  });

  it('still rejects an unknown state', () => {
    expect(errorsFor({ publishState: 'nonsense' }).length).toBeGreaterThan(0);
  });
});
