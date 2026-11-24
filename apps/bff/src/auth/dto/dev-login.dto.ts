import { IsString, Matches } from 'class-validator';
import { phoneErrorMessage } from '@bhavano/types/market';
import { MARKET } from '../../market/market-config';

export class DevLoginDto {
  @IsString()
  @Matches(MARKET.phoneNationalPattern, {
    message: phoneErrorMessage(MARKET.id),
  })
  phone!: string;
}
