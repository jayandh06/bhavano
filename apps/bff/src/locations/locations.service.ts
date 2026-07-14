import { Injectable } from '@nestjs/common';
import type { Area as AreaDto, City as CityDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import type { Area, City } from '@prisma/client';

function toDto(city: City): CityDto {
  return {
    id: city.id,
    name: city.name,
    state: city.state,
    lat: city.lat,
    lng: city.lng,
    isPopular: city.isPopular,
  };
}

function toAreaDto(area: Area): AreaDto {
  return { id: area.id, name: area.name, cityId: area.cityId, lat: area.lat, lng: area.lng };
}

/** Great-circle distance in km — good enough for nearest-city lookup at city granularity. */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchCities(q?: string): Promise<CityDto[]> {
    if (!q) {
      const popular = await this.prisma.city.findMany({
        where: { isPopular: true },
        orderBy: { name: 'asc' },
      });
      return popular.map(toDto);
    }

    const matches = await this.prisma.city.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { state: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 10,
    });
    return matches.map(toDto);
  }

  async searchAreas(cityId: string, q?: string): Promise<AreaDto[]> {
    const matches = await this.prisma.area.findMany({
      where: { cityId, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: { name: 'asc' },
      take: 15,
    });
    return matches.map(toAreaDto);
  }

  /** Nearest-city lookup for "Auto-detect" — plain distance calc over all cities;
   * swap for a real PostGIS ST_Distance query once city count grows past a full scan. */
  async reverseGeocode(lat: number, lng: number): Promise<CityDto | null> {
    const cities = await this.prisma.city.findMany();
    if (cities.length === 0) return null;

    let nearest = cities[0];
    let nearestDist = haversineKm({ lat, lng }, nearest);
    for (const city of cities.slice(1)) {
      const dist = haversineKm({ lat, lng }, city);
      if (dist < nearestDist) {
        nearest = city;
        nearestDist = dist;
      }
    }
    return toDto(nearest);
  }
}
