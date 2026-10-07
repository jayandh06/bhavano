import { ThrottlerException } from '@nestjs/throttler';
import { RateLimitService } from './rate-limit.service';
import { PrismaService } from '../prisma/prisma.service';

function makeService(settings: Record<string, number> = {}, hitCount = 0) {
  const prisma = {
    rateLimitSetting: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'singleton',
        publishLimit: 5,
        publishWindowMinutes: 1440,
        viewLimit: 200,
        viewWindowMinutes: 60,
        aiGenerateLimit: 10,
        aiGenerateWindowMinutes: 1440,
        ...settings,
      }),
    },
    rateLimitHit: {
      count: jest.fn().mockResolvedValue(hitCount),
      create: jest.fn().mockResolvedValue(undefined),
    },
  } as unknown as PrismaService;

  const service = new RateLimitService(prisma);
  return { service, prisma };
}

describe('RateLimitService.checkAndRecordHit', () => {
  it("reads the ai_generate settings columns, not view's, for an ai_generate hit", async () => {
    const { service, prisma } = makeService({ aiGenerateLimit: 3, viewLimit: 200 }, 2);

    await service.checkAndRecordHit('user1', 'ai_generate');

    // Under the ai_generate limit (3) despite being over a view-sized count — proves the branch
    // actually reads aiGenerateLimit, not a silent fallthrough to viewLimit.
    expect(prisma.rateLimitHit.create).toHaveBeenCalledWith({ data: { identity: 'user:user1', kind: 'ai_generate' } });
  });

  it('throws once the ai_generate count reaches its own limit', async () => {
    const { service } = makeService({ aiGenerateLimit: 3 }, 3);

    await expect(service.checkAndRecordHit('user1', 'ai_generate')).rejects.toThrow(ThrottlerException);
  });

  it('view hits are unaffected by a tight ai_generate limit', async () => {
    const { service, prisma } = makeService({ aiGenerateLimit: 1, viewLimit: 200 }, 50);

    await service.checkAndRecordHit('user1', 'view');

    expect(prisma.rateLimitHit.create).toHaveBeenCalledWith({ data: { identity: 'user:user1', kind: 'view' } });
  });

  it('publish stays a no-op, unaffected by the new kind', async () => {
    const { service, prisma } = makeService();

    await service.checkAndRecordHit('user1', 'publish');

    expect(prisma.rateLimitHit.create).not.toHaveBeenCalled();
  });
});
