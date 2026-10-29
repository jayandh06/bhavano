import { adIdClause } from './ad-id-filter';

describe('adIdClause', () => {
  it('applies nothing for an empty value', () => {
    expect(adIdClause('campaignId', undefined)).toBeUndefined();
    expect(adIdClause('campaignId', ' , ')).toBeUndefined();
  });

  it('treats one id (an older shared link) as a list of one', () => {
    expect(adIdClause('campaignId', '123')).toEqual({ campaignId: { in: ['123'] } });
  });

  it('matches any of several ids', () => {
    expect(adIdClause('adGroupId', '1, 2,3')).toEqual({ adGroupId: { in: ['1', '2', '3'] } });
  });

  it('reads `none` as a null column, alone or beside ids', () => {
    expect(adIdClause('campaignId', 'none')).toEqual({ campaignId: null });
    expect(adIdClause('campaignId', '1,none')).toEqual({ OR: [{ campaignId: { in: ['1'] } }, { campaignId: null }] });
  });
});
