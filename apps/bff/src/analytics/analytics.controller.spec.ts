import { AnalyticsController } from './analytics.controller';
import type { AnalyticsService } from './analytics.service';

describe('AnalyticsController.linkSession', () => {
  it('links the given analytics session to the calling user', async () => {
    const linkVisitToUser = jest.fn().mockResolvedValue(undefined);
    const controller = new AnalyticsController({
      linkVisitToUser,
    } as unknown as AnalyticsService);

    const result = await controller.linkSession(
      { sessionId: 'sess-1' },
      { id: 'user-1', role: 'user' },
    );

    expect(linkVisitToUser).toHaveBeenCalledWith('sess-1', 'user-1');
    expect(result).toEqual({ success: true });
  });
});
