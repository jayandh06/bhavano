import { SavedSearchesController } from './saved-searches.controller';
import type { SavedSearchesService } from './saved-searches.service';

/** The /saved-searches page decides "show the create form" vs "show the upgrade prompt" purely
 * from `canCreate` — these pin the mapping from the service's `null | {source, freeRemaining}`
 * onto that flat shape, since a wrong mapping here silently reintroduces the bug this endpoint was
 * added to fix (the page showing a paywall to someone who still has a free alert available). */
describe('SavedSearchesController.allowance', () => {
  function makeController(alertAllowance: unknown) {
    const service = { alertAllowance: jest.fn().mockResolvedValue(alertAllowance) } as unknown as SavedSearchesService;
    return { controller: new SavedSearchesController(service), service };
  }

  it('maps a free slot to canCreate: true with the remaining count', async () => {
    const { controller } = makeController({ source: 'free', freeRemaining: 1 });
    expect(await controller.allowance({ id: 'u1' } as never)).toEqual({
      canCreate: true,
      source: 'free',
      freeRemaining: 1,
    });
  });

  it('maps an active Plus subscription to canCreate: true', async () => {
    const { controller } = makeController({ source: 'plus', freeRemaining: 0 });
    expect(await controller.allowance({ id: 'u1' } as never)).toEqual({
      canCreate: true,
      source: 'plus',
      freeRemaining: 0,
    });
  });

  it('maps "neither" (null) to canCreate: false — this is the only case that shows the upgrade prompt', async () => {
    const { controller } = makeController(null);
    expect(await controller.allowance({ id: 'u1' } as never)).toEqual({
      canCreate: false,
      freeRemaining: 0,
    });
  });
});
