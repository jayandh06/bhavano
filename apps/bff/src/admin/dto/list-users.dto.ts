import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { SellerType, UserRole } from '@bhavano/types';

const USER_ROLES: UserRole[] = ['user', 'admin'];
const USER_SORT_VALUES = [
  'createdAt_desc',
  'createdAt_asc',
  'name_asc',
  'name_desc',
  'phone_asc',
  'phone_desc',
  'email_asc',
  'email_desc',
  'city_asc',
  'city_desc',
  'liveListings_asc',
  'liveListings_desc',
  'contactRevealsLeft_asc',
  'contactRevealsLeft_desc',
  'listings_desc',
] as const;

export type UserSort = (typeof USER_SORT_VALUES)[number];

export class ListUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  minLiveListings?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  maxLiveListings?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  minContactRevealsLeft?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  maxContactRevealsLeft?: number;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  @IsOptional()
  @IsIn(['yes', 'no'])
  welcomed?: 'yes' | 'no';

  /** `unset` = never answered "Owner or agent?". */
  @IsOptional()
  @IsIn(['owner', 'agent', 'unset'])
  sellerType?: SellerType | 'unset';

  @IsOptional()
  @IsIn(USER_SORT_VALUES)
  sort?: UserSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}
