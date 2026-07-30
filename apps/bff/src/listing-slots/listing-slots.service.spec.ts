import { ForbiddenException } from '@nestjs/common';
import { ListingSlotsService } from './listing-slots.service';
import { PrismaService } from '../prisma/prisma.service';

const HOUR_MS = 60 * 60 * 1000;
const future = (hours = 1) => new Date(Date.now() + hours * HOUR_MS);
const past = (hours = 1) => new Date(Date.now() - hours * HOUR_MS);

function makePrisma(user: Record<string, unknown>, activeCount = 0) {
  return {
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue(user) },
    listing: { count: jest.fn().mockResolvedValue(activeCount) },
  } as unknown as PrismaService;
}

describe('ListingSlotsService', () => {
  const baseUser = { id: 'u1', sellerSlotPackUntil: null, agentProUntil: null, agentProUnits: 1 };

  describe('getSummary — allowance by membership tier', () => {
    it('free user (no add-on) gets the base 5 slots', async () => {
      const service = new ListingSlotsService(makePrisma(baseUser, 3));
      await expect(service.getSummary('u1')).resolves.toEqual({ activeCount: 3, allowance: 5 });
    });

    it('active sellerSlotPack raises allowance to 10', async () => {
      const user = { ...baseUser, sellerSlotPackUntil: future() };
      const service = new ListingSlotsService(makePrisma(user));
      await expect(service.getSummary('u1')).resolves.toMatchObject({ allowance: 10 });
    });

    it('expired sellerSlotPack falls back to the free allowance', async () => {
      const user = { ...baseUser, sellerSlotPackUntil: past() };
      const service = new ListingSlotsService(makePrisma(user));
      await expect(service.getSummary('u1')).resolves.toMatchObject({ allowance: 5 });
    });

    it.each([
      [1, 20],
      [3, 60],
      [undefined, 20],
      [0, 20],
      [-2, 20],
    ])('active agentPro with agentProUnits=%p yields allowance %p', async (units, expected) => {
      const user = { ...baseUser, agentProUntil: future(), agentProUnits: units };
      const service = new ListingSlotsService(makePrisma(user));
      await expect(service.getSummary('u1')).resolves.toMatchObject({ allowance: expected });
    });

    it('expired agentPro falls back to the free allowance regardless of agentProUnits', async () => {
      const user = { ...baseUser, agentProUntil: past(), agentProUnits: 5 };
      const service = new ListingSlotsService(makePrisma(user));
      await expect(service.getSummary('u1')).resolves.toMatchObject({ allowance: 5 });
    });

    it('sellerSlotPack + agentPro both active take the higher of the two', async () => {
      const user = { ...baseUser, sellerSlotPackUntil: future(), agentProUntil: future(), agentProUnits: 1 };
      const service = new ListingSlotsService(makePrisma(user));
      await expect(service.getSummary('u1')).resolves.toMatchObject({ allowance: 20 });
    });

    it('a lapsed sellerSlotPack alongside an active, larger agentPro still reflects agentPro only', async () => {
      const user = { ...baseUser, sellerSlotPackUntil: past(), agentProUntil: future(), agentProUnits: 3 };
      const service = new ListingSlotsService(makePrisma(user));
      await expect(service.getSummary('u1')).resolves.toMatchObject({ allowance: 60 });
    });
  });

  describe('assertCanPublish', () => {
    it('allows publishing when active count is below the allowance', async () => {
      const service = new ListingSlotsService(makePrisma(baseUser, 4));
      await expect(service.assertCanPublish('u1')).resolves.toBeUndefined();
    });

    it('a free user at cap is offered both upsells', async () => {
      const service = new ListingSlotsService(makePrisma(baseUser, 5));
      await expect(service.assertCanPublish('u1')).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'LISTING_SLOT_CAP_REACHED',
          activeCount: 5,
          allowance: 5,
          upsell: ['sellerSlotPack', 'agentPro'],
        }),
      });
    });

    it('a sellerSlotPack user at their 10-slot cap is offered only the agentPro upsell', async () => {
      const user = { ...baseUser, sellerSlotPackUntil: future() };
      const service = new ListingSlotsService(makePrisma(user, 10));
      await expect(service.assertCanPublish('u1')).rejects.toMatchObject({
        response: expect.objectContaining({ upsell: ['agentPro'] }),
      });
    });

    it('a user over cap (e.g. after a downgrade) is still blocked', async () => {
      const service = new ListingSlotsService(makePrisma(baseUser, 9));
      await expect(service.assertCanPublish('u1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
