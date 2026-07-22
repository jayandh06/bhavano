import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { LoginMethod } from '@bhavano/types';

const LOGIN_METHODS: LoginMethod[] = ['otp', 'google'];
const LOGIN_SORT_VALUES = ['createdAt_desc', 'createdAt_asc'] as const;

export type LoginSort = (typeof LOGIN_SORT_VALUES)[number];

export class ListLoginsDto {
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
  userId?: string;

  @IsOptional()
  @IsIn(LOGIN_METHODS)
  method?: LoginMethod;

  @IsOptional()
  @IsIn(LOGIN_SORT_VALUES)
  sort?: LoginSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
