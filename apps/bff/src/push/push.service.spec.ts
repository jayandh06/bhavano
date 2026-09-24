import { ConfigService } from '@nestjs/config';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';

function makeService(opts: {
  enabled?: boolean;
  accessToken?: string;
  tokens?: { token: string }[];
  fetchImpl?: jest.Mock;
}) {
  const upsert = jest.fn().mockResolvedValue(undefined);
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const findMany = jest.fn().mockResolvedValue(opts.tokens ?? []);
  const prisma = {
    pushToken: { upsert, deleteMany, findMany },
  } as unknown as PrismaService;
  const config = {
    get: (key: string) => {
      if (key === 'EXPO_PUSH_ENABLED' && opts.enabled) return 'true';
      if (key === 'EXPO_ACCESS_TOKEN') return opts.accessToken;
      return undefined;
    },
  } as unknown as ConfigService;
  const fetchMock = opts.fetchImpl ?? jest.fn();
  global.fetch = fetchMock;
  return {
    service: new PushService(prisma, config),
    upsert,
    deleteMany,
    findMany,
    fetchMock,
  };
}

const message = {
  id: 'm1',
  conversationId: 'c1',
  senderId: 'u2',
  body: 'hello',
  createdAt: '',
  readAt: null,
  deletedAt: null,
};

describe('PushService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does nothing when EXPO_PUSH_ENABLED is not "true"', async () => {
    const { service, findMany, fetchMock } = makeService({
      enabled: false,
      tokens: [{ token: 'ExpoTok[a]' }],
    });
    await service.notifyNewMessage('u1', message, 'Asha');
    expect(findMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the network call when the recipient has no registered tokens', async () => {
    const { service, fetchMock } = makeService({ enabled: true, tokens: [] });
    await service.notifyNewMessage('u1', message, 'Asha');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes a token Expo reports as DeviceNotRegistered', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { status: 'ok', id: 'r1' },
            {
              status: 'error',
              message: 'gone',
              details: { error: 'DeviceNotRegistered' },
            },
          ],
        }),
    });
    const { service, deleteMany } = makeService({
      enabled: true,
      tokens: [{ token: 'ExpoTok[good]' }, { token: 'ExpoTok[dead]' }],
      fetchImpl,
    });

    await service.notifyNewMessage('u1', message, 'Asha');

    expect(deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['ExpoTok[dead]'] } },
    });
  });

  it('never throws when the Expo request itself fails', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('network down'));
    const { service } = makeService({
      enabled: true,
      tokens: [{ token: 'ExpoTok[a]' }],
      fetchImpl,
    });
    await expect(
      service.notifyNewMessage('u1', message, 'Asha'),
    ).resolves.toBeUndefined();
  });

  it('registerToken upserts keyed on the token, re-pointing it to the current user', async () => {
    const { service, upsert } = makeService({ enabled: true });
    await service.registerToken('u1', 'ExpoTok[x]', 'ios');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'ExpoTok[x]' },
        create: { userId: 'u1', token: 'ExpoTok[x]', platform: 'ios' },
      }),
    );
  });

  it('sends Authorization Bearer when EXPO_ACCESS_TOKEN is set', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ status: 'ok', id: 'r1' }] }),
    });
    const { service } = makeService({
      enabled: true,
      accessToken: 'expo_pat_test',
      tokens: [{ token: 'ExpoTok[a]' }],
      fetchImpl,
    });
    await service.notifyNewMessage('u1', message, 'Asha');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer expo_pat_test',
        }),
      }),
    );
  });
});
