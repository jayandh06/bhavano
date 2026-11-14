import { DEFAULT_POST_FORM_SETTINGS, POST_FORM_SETTINGS_ID, PostFormService } from './post-form.service';
import type { PrismaService } from '../prisma/prisma.service';

function makeService(postFormSetting: Record<string, jest.Mock>) {
  return new PostFormService({ postFormSetting } as unknown as PrismaService);
}

describe('PostFormService.getSettings', () => {
  it('returns the stored share', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: POST_FORM_SETTINGS_ID, v2Percent: 50 });
    const create = jest.fn();
    expect(await makeService({ findUnique, create }).getSettings()).toEqual({ v2Percent: 50 });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the row with nobody on the new form the first time, so deploying never changes what visitors see', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const create = jest.fn(({ data }: { data: object }) => Promise.resolve(data));
    expect(await makeService({ findUnique, create }).getSettings()).toEqual({ v2Percent: 0 });
    expect(create).toHaveBeenCalledWith({ data: { id: POST_FORM_SETTINGS_ID, ...DEFAULT_POST_FORM_SETTINGS } });
  });

  it('never reports a share outside 0 to 100, even from a bad row', async () => {
    for (const [stored, expected] of [
      [250, 100],
      [-5, 0],
      [12.5, 0],
    ] as const) {
      const findUnique = jest.fn().mockResolvedValue({ id: POST_FORM_SETTINGS_ID, v2Percent: stored });
      expect(await makeService({ findUnique, create: jest.fn() }).getSettings()).toEqual({ v2Percent: expected });
    }
  });
});

describe('PostFormService.updateSettings', () => {
  it('upserts the single row with the new share', async () => {
    const upsert = jest.fn(({ update }: { update: { v2Percent: number } }) => Promise.resolve({ id: POST_FORM_SETTINGS_ID, ...update }));
    const result = await makeService({ upsert }).updateSettings({ v2Percent: 25 });
    expect(result).toEqual({ v2Percent: 25 });
    expect(upsert).toHaveBeenCalledWith({
      where: { id: POST_FORM_SETTINGS_ID },
      update: { v2Percent: 25 },
      create: { id: POST_FORM_SETTINGS_ID, v2Percent: 25 },
    });
  });
});
