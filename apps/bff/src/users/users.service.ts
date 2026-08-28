import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { UserProfileDto } from '@bhavano/types';
import type { User, City } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ListingSlotsService } from '../listing-slots/listing-slots.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingSlotsService: ListingSlotsService,
  ) {}

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { city: true },
    });
    if (!user) throw new NotFoundException('User not found');
    // A JWT outlives the account it names — tokens are stateless with a 1h TTL and AuthGuard is
    // deliberately DB-free, so a session issued before deletion still authenticates. Rejecting
    // here logs the holder out everywhere, since apps/web maps a 401 to requiresLogin and
    // ProfileCompletionBanner refetches this on every navigation.
    if (user.deletedAt)
      throw new UnauthorizedException('This account was deleted');
    const { activeCount, allowance } =
      await this.listingSlotsService.getSummary(userId);
    return toProfileDto(user, activeCount, allowance);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
      });
      if (!city) throw new BadRequestException('Unknown cityId');
    }

    // No try/catch for P2002 any more: the only unique field this endpoint could collide on was
    // `email`, and an address now reaches the profile solely through the verified flow, which
    // does its own conflict handling.
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.cityId !== undefined ? { cityId: dto.cityId } : {}),
      },
      include: { city: true },
    });
    const { activeCount, allowance } =
      await this.listingSlotsService.getSummary(userId);
    return toProfileDto(user, activeCount, allowance);
  }
}

function toProfileDto(
  user: User & { city: City | null },
  activeListingCount: number,
  listingSlotAllowanceValue: number,
): UserProfileDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: !!user.emailVerifiedAt,
    phone: user.phone,
    cityId: user.cityId,
    cityName: user.city?.name ?? null,
    state: user.city?.state ?? null,
    premiumUntil: user.premiumUntil?.toISOString() ?? null,
    agentProUntil: user.agentProUntil?.toISOString() ?? null,
    sellerSlotPackUntil: user.sellerSlotPackUntil?.toISOString() ?? null,
    agentProUnits: user.agentProUnits,
    activeListingCount,
    listingSlotAllowance: listingSlotAllowanceValue,
  };
}
