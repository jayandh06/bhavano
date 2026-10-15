import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/** What the iOS app wants to buy. The server resolves it to a concrete Apple product, so a client
 * cannot name an arbitrary product: a boost is identified by listing and duration, never by id. */
export class CreateAppleIntentDto {
  @IsIn(['subscription', 'boost', 'credits'])
  type!: 'subscription' | 'boost' | 'credits';

  /** Subscriptions only. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  productId?: string;

  /** Boosts only. */
  @IsOptional()
  @IsString()
  listingId?: string;

  /** Boosts only. */
  @IsOptional()
  @IsInt()
  boostDays?: number;
}

export class VerifyAppleTransactionDto {
  /** The JWS StoreKit 2 returns for the purchase (`signedTransactionInfo` / `jwsRepresentation`). */
  @IsString()
  @MaxLength(20000)
  signedTransaction!: string;
}

export class AppleNotificationDto {
  @IsString()
  @MaxLength(100000)
  signedPayload!: string;
}
