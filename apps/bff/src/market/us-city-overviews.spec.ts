import { validateAreaOverviewContent } from '@bhavano/types/areaOverview';
import { slugify } from '@bhavano/types/slugify';
import { US_CITY_OVERVIEW_DRAFTS } from '../../scripts/us-city-overview-drafts';
import { loadUsCities } from '../../prisma/seedUsCities';

const text = (c: (typeof US_CITY_OVERVIEW_DRAFTS)[string]) =>
  [...c.about, ...c.gettingAround, ...c.faqs.flatMap((f) => [f.question, f.answer])].join(' ');

describe('US city overview drafts', () => {
  it('cover every launch city, keyed the way the seed script matches them', () => {
    expect(Object.keys(US_CITY_OVERVIEW_DRAFTS).sort()).toEqual(loadUsCities().map((c) => slugify(c.name)).sort());
  });

  it('pass the same validator the admin editor uses', () => {
    for (const [key, content] of Object.entries(US_CITY_OVERVIEW_DRAFTS)) expect([key, validateAreaOverviewContent(content)]).toEqual([key, []]);
  });

  it('say nothing about who lives somewhere, safety or schools, carry no figures, and name nothing India-only', () => {
    const banned = /famil(y|ies)|professionals|students|seniors|retirees|bachelor|religio|ethnic|diverse|communit(y|ies)|\bsafe(r|st|ty)?\b|crime|school|\$|₹|\d\s?%|\bBHK\b|\blakh|\bPG\b|neighbourhood|checks listings before/i;
    for (const [key, content] of Object.entries(US_CITY_OVERVIEW_DRAFTS)) expect([key, text(content).match(banned)?.[0]]).toEqual([key, undefined]);
  });

  it('does not repeat an About paragraph between cities', () => {
    const all = Object.values(US_CITY_OVERVIEW_DRAFTS).flatMap((c) => c.about);
    expect(new Set(all).size).toBe(all.length);
  });

  it('rejects a typed dollar amount, so rents cannot be hardcoded', () => {
    const content = { ...US_CITY_OVERVIEW_DRAFTS.austin, about: ['A typical apartment here rents for around $1500 each month, more downtown.'] };
    expect(validateAreaOverviewContent(content).join(' ')).toMatch(/Remove prices/);
  });
});
