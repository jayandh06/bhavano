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

  it('includes Expo attributes: priority, icon, badge, collapse/tag/thread, channel', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ status: 'ok', id: 'r1' }] }),
    });
    const { service } = makeService({
      enabled: true,
      tokens: [{ token: 'ExpoTok[a]' }],
      fetchImpl,
    });
    await service.notifyNewMessage('u1', message, 'Asha', {
      unreadCount: 3,
      listingTitle: '2 BHK in Koramangala',
    });
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as { body: string }).body) as Array<
      Record<string, unknown>
    >;
    expect(body[0]).toMatchObject({
      to: 'ExpoTok[a]',
      title: '2 BHK in Koramangala',
      body: 'Asha: hello',
      badge: 3,
      sound: 'default',
      channelId: 'messages',
      priority: 'high',
      icon: 'notification_icon',
      collapseId: 'c1',
      tag: 'msg:c1',
      threadId: 'c1',
      interruptionLevel: 'time-sensitive',
      data: { kind: 'message', conversationId: 'c1', listingTitle: '2 BHK in Koramangala' },
    });
  });

  it('falls back to the sender as title, with no prefix, when the listing title is unknown', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ status: 'ok', id: 'r1' }] }),
    });
    const { service } = makeService({
      enabled: true,
      tokens: [{ token: 'ExpoTok[a]' }],
      fetchImpl,
    });
    await service.notifyNewMessage('u1', message, 'Asha');
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as { body: string }).body) as Array<
      Record<string, unknown>
    >;
    expect(body[0]).toMatchObject({ title: 'Asha', body: 'hello' });
  });

  it('sends listing-activity pushes with listing title, listing channel, and optional image', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ status: 'ok', id: 'r1' }] }),
    });
    const { service } = makeService({
      enabled: true,
      tokens: [{ token: 'ExpoTok[a]' }],
      fetchImpl,
    });
    await service.notifyListingInterest('u1', {
      listingId: 'l1',
      listingTitle: 'PG in Indiranagar',
      interestedName: 'Ravi',
      imageUrl: 'https://cdn.example/preview.jpg',
    });
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as { body: string }).body) as Array<
      Record<string, unknown>
    >;
    expect(body[0]).toMatchObject({
      title: 'PG in Indiranagar',
      body: '👀 Ravi viewed your ad',
      channelId: 'listing_activity',
      icon: 'notification_icon',
      richContent: { image: 'https://cdn.example/preview.jpg' },
      data: { kind: 'listing_interest', path: '/my-listings', listingId: 'l1' },
    });
  });
});
