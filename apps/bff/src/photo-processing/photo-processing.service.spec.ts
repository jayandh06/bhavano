import sharp from 'sharp';
import { PhotoProcessingService } from './photo-processing.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../storage/r2-storage.service';

/** A tiny real image, since the service actually runs it through sharp — a fixture buffer, not a
 * mock, because the whole point of these tests is to exercise the real resize/rotate/webp
 * pipeline, not just which functions got called. */
async function fixtureImage(): Promise<Buffer> {
  return sharp({
    create: {
      width: 40,
      height: 20,
      channels: 3,
      background: { r: 200, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();
}

function makeJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'job1',
    listingId: 'l1',
    photoNo: 1,
    ext: 'jpg',
    variant: 'preview',
    status: 'pending',
    attempts: 0,
    error: null,
    ...overrides,
  };
}

interface UpdateManyCall {
  where: { id: string; status?: string };
  data: Record<string, unknown>;
}

/** Mimics real Prisma updateMany semantics against a single tracked "real" row status: the call
 * only takes effect (count: 1) if the where clause's status (when present) matches, otherwise it
 * reports count: 0, same as a real WHERE clause matching nothing. Every call is recorded so tests
 * can assert on it without touching jest's loosely-typed `.mock.calls`. */
function trackedUpdateMany(initialStatus: string) {
  let realStatus = initialStatus;
  const calls: UpdateManyCall[] = [];
  const fn = jest.fn((args: UpdateManyCall) => {
    calls.push(args);
    const matches =
      args.where.status === undefined || args.where.status === realStatus;
    if (matches && typeof args.data.status === 'string')
      realStatus = args.data.status;
    return Promise.resolve({ count: matches ? 1 : 0 });
  });
  return { fn, calls };
}

describe('PhotoProcessingService', () => {
  let original: Buffer;

  beforeAll(async () => {
    original = await fixtureImage();
  });

  /** Regression test for a real bug: an admin's rotate click resets a photo's variant jobs back
   * to 'pending' for reprocessing at the new rotation. If that reset lands while a PREVIOUS,
   * now-stale run of processPending() for the same job is still mid-flight (a real possibility —
   * that run does a network round trip to R2 for both the download and the upload), the stale
   * run's completion write must not clobber the newer 'pending' status with 'done'. Getting this
   * wrong meant one rotate click's effect could be silently swallowed forever — see
   * docs/plans/listing-photo-orientation.md. */
  it('does not mark a job done if it was reset back to pending while mid-flight', async () => {
    // `job` is the stale snapshot this run picked up at the top of the loop — it still says
    // 'processing'. The row's real status has already moved to 'pending' by the time our
    // completion write fires, simulating an admin's rotate click landing mid-flight.
    const job = makeJob({ status: 'processing' });
    const { fn: updateMany, calls } = trackedUpdateMany('pending');

    const prisma = {
      photoVariantJob: {
        findMany: jest.fn().mockResolvedValueOnce([job]),
        update: jest.fn(),
        updateMany,
      },
      listingPhoto: {
        findUnique: jest.fn().mockResolvedValue({ rotation: 90 }),
      },
    } as unknown as PrismaService;
    const getObject = jest.fn().mockResolvedValue(original);
    const putObject = jest.fn().mockResolvedValue(undefined);
    const storage = { getObject, putObject } as unknown as R2StorageService;

    const service = new PhotoProcessingService(prisma, storage);
    await service.processPending();

    // The work still happened (we don't know it's stale until after doing it) ...
    expect(putObject).toHaveBeenCalledTimes(1);
    // ... but the completion write must have gone through the guarded updateMany, matched on
    // status:'processing', and found nothing — the row's real (newer) 'pending' status survives.
    const doneCall = calls.find((c) => c.data.status === 'done');
    expect(doneCall).toBeDefined();
    expect(doneCall?.where).toMatchObject({ id: job.id, status: 'processing' });
  });

  it('marks a job done normally when nothing reset it mid-flight', async () => {
    const job = makeJob({ status: 'processing' });
    const { fn: updateMany, calls } = trackedUpdateMany('processing');

    const prisma = {
      photoVariantJob: {
        findMany: jest.fn().mockResolvedValueOnce([job]),
        update: jest.fn(),
        updateMany,
      },
      listingPhoto: {
        findUnique: jest.fn().mockResolvedValue({ rotation: 0 }),
      },
    } as unknown as PrismaService;
    const getObject = jest.fn().mockResolvedValue(original);
    const putObject = jest.fn().mockResolvedValue(undefined);
    const storage = { getObject, putObject } as unknown as R2StorageService;

    const service = new PhotoProcessingService(prisma, storage);
    await service.processPending();

    expect(putObject).toHaveBeenCalledTimes(1);
    const doneCall = calls.find((c) => c.data.status === 'done');
    expect(doneCall).toEqual({
      where: { id: job.id, status: 'processing' },
      data: { status: 'done' },
    });
  });

  it('does not overwrite a mid-flight reset with a failure status either', async () => {
    const job = makeJob({ status: 'processing', attempts: 0 });
    const { fn: updateMany, calls } = trackedUpdateMany('pending'); // already reset before we fail

    const prisma = {
      photoVariantJob: {
        findMany: jest.fn().mockResolvedValueOnce([job]),
        update: jest.fn(),
        updateMany,
      },
      listingPhoto: {
        findUnique: jest.fn().mockResolvedValue({ rotation: 0 }),
      },
    } as unknown as PrismaService;
    // Fails the run, exercising the catch-block write instead of the success path.
    const getObject = jest.fn().mockRejectedValue(new Error('R2 unavailable'));
    const putObject = jest.fn();
    const storage = { getObject, putObject } as unknown as R2StorageService;

    const service = new PhotoProcessingService(prisma, storage);
    await service.processPending();

    expect(putObject).not.toHaveBeenCalled();
    const failureCall = calls.find((c) => 'attempts' in c.data);
    expect(failureCall).toBeDefined();
    expect(failureCall?.where).toMatchObject({
      id: job.id,
      status: 'processing',
    });
  });
});
