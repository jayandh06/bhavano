import { ListingsController } from './listings.controller';
import type { ListingsService } from './listings.service';
import type { R2StorageService } from '../storage/r2-storage.service';
import type { ListingPhotosService } from './listing-photos.service';
import type { ContactRevealService } from '../contact-reveal/contact-reveal.service';
import type { LoginNudgeService } from './login-nudge.service';

describe('ListingsController.recordView', () => {
  const recordView = jest.fn().mockResolvedValue({ viewCount: 8 });
  const getViewCount = jest.fn().mockResolvedValue({ viewCount: 7 });
  const controller = new ListingsController(
    { recordView, getViewCount } as unknown as ListingsService,
    {} as R2StorageService,
    {} as ListingPhotosService,
    {} as ContactRevealService,
    {} as LoginNudgeService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('does not count a visit by an admin', async () => {
    await expect(controller.recordView('l1', { viewerKey: 'k' }, { id: 'a1', role: 'admin' })).resolves.toEqual({
      viewCount: 7,
    });
    expect(recordView).not.toHaveBeenCalled();
    expect(getViewCount).toHaveBeenCalledWith('l1');
  });

  it('counts a logged-in user by account and an anonymous visitor by device key', async () => {
    await controller.recordView('l1', { viewerKey: 'k' }, { id: 'u1', role: 'user' });
    await controller.recordView('l1', { viewerKey: 'k' }, undefined);
    expect(recordView).toHaveBeenNthCalledWith(1, 'l1', 'user:u1');
    expect(recordView).toHaveBeenNthCalledWith(2, 'l1', 'anon:k');
    expect(getViewCount).not.toHaveBeenCalled();
  });
});
