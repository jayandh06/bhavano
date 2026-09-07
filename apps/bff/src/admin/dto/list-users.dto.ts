import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { UserRole } from '@bhavano/types';

const USER_ROLES: UserRole[] = ['user', 'admin'];
const USER_SORT_VALUES = ['createdAt_desc', 'createdAt_asc', 'name_asc'] as const;

export type UserSort = (typeof USER_SORT_VALUES)[number];

export class ListUsersDto {
  @IsOptional()
  @IsString()
  cursor?: string;

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
  @IsIn(USER_ROLES)
  role?: UserRole;

  @IsOptional()
  @IsIn(['yes', 'no'])
  welcomed?: 'yes' | 'no';

  @IsOptional()
  @IsIn(USER_SORT_VALUES)
  sort?: UserSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
