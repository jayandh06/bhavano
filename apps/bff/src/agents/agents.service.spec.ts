import { NotFoundException } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';

const HOUR_MS = 60 * 60 * 1000;
const future = (hours = 1) => new Date(Date.now() + hours * HOUR_MS);
const past = (hours = 1) => new Date(Date.now() - hours * HOUR_MS);

function makeService() {
  const prisma = { user: { findUnique: jest.fn() } } as unknown as PrismaService;
  const listingsService = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) } as unknown as ListingsService;
  const service = new AgentsService(prisma, listingsService);
  return { service, prisma };
}

describe('AgentsService.getStorefront — Agent Pro badge', () => {
  it('shows isAgentPro:true for an active Agent Pro subscriber', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      name: 'Ravi',
      agentProUntil: future(),
      createdAt: new Date(),
    });
    await expect(service.getStorefront('u1')).resolves.toMatchObject({ isAgentPro: true });
  });

  it('shows isAgentPro:false once the subscription has lapsed', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      name: 'Ravi',
      agentProUntil: past(),
      createdAt: new Date(),
    });
    await expect(service.getStorefront('u1')).resolves.toMatchObject({ isAgentPro: false });
  });

  it('shows isAgentPro:false for a free user (agentProUntil: null)', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      name: 'Ravi',
      agentProUntil: null,
      createdAt: new Date(),
    });
    await expect(service.getStorefront('u1')).resolves.toMatchObject({ isAgentPro: false });
  });

  it('throws NotFoundException when the user does not exist', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.getStorefront('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
