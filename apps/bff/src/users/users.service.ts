import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserProfileDto } from '@bhavano/types';
import type { User, City } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { city: true } });
    if (!user) throw new NotFoundException('User not found');
    return toProfileDto(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfileDto> {
    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
      if (!city) throw new BadRequestException('Unknown cityId');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.cityId !== undefined ? { cityId: dto.cityId } : {}),
      },
      include: { city: true },
    });
    return toProfileDto(user);
  }
}

function toProfileDto(user: User & { city: City | null }): UserProfileDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    cityId: user.cityId,
    cityName: user.city?.name ?? null,
    state: user.city?.state ?? null,
  };
}
