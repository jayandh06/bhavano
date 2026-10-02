import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { ReferralStatus } from '@bhavano/types';

const REFERRAL_STATUSES: ReferralStatus[] = ['signed_up', 'ad_approved', 'rewarded', 'blocked', 'reversed'];
export const REFERRAL_FUNNEL_DAYS = [7, 30, 90] as const;

export class ListReferralsDto {
  @IsOptional()
  @IsIn(REFERRAL_STATUSES)
  status?: ReferralStatus;

  /** Only referrals whose referrer is frozen. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  frozen?: boolean;

  @IsOptional()
  @IsString()
  referrerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}

export class ReferralFunnelQueryDto {
  /** Omitted = all time. */
  @IsOptional()
  @Type(() => Number)
  @IsIn(REFERRAL_FUNNEL_DAYS)
  sinceDays?: (typeof REFERRAL_FUNNEL_DAYS)[number];
}

/** Reversing a referral or freezing a referrer always says why — it lands in the audit log. */
export class ReferralReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ReferralNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateReferralSettingsDto {
  @IsInt()
  @Min(1)
  @Max(30)
  boostDays!: number;

  @IsInt()
  @Min(1)
  @Max(365)
  creditExpiryDays!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  monthlyCapPerReferrer!: number;

  @IsInt()
  @Min(1)
  bonusExtraBoostAtReferrals!: number;

  @IsInt()
  @Min(1)
  topAgentBadgeAtReferrals!: number;

  @IsBoolean()
  welcomeRewardEnabled!: boolean;

  @IsInt()
  @Min(1)
  @Max(30)
  welcomeRewardFeaturedDays!: number;

  @IsInt()
  @Min(1)
  @Max(365)
  attributionWindowDays!: number;

  @IsInt()
  @Min(0)
  @Max(365)
  takedownRevocationWindowDays!: number;
}
