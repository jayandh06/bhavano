import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  CampaignAudienceFilter,
  CampaignStatus,
  ContactSource,
  ConsentState,
  OutreachChannel,
} from '@bhavano/types';

const CONTACT_SOURCES: ContactSource[] = ['google_maps', 'scrape', 'manual_upload', 'referral'];
const CHANNELS: OutreachChannel[] = ['sms', 'whatsapp', 'email'];
const CAMPAIGN_STATUSES: CampaignStatus[] = ['draft', 'scheduled', 'running', 'paused', 'completed'];
const CONSENT_STATES: ConsentState[] = ['none', 'implied', 'explicit', 'opted_out'];

export class ListOutreachContactsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 25;

  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() cityId?: string;
  @IsOptional() @IsString() areaId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() businessCategory?: string;
  @IsOptional() @IsString() placesFetchLogId?: string;
  @IsOptional() @IsEnum(CONSENT_STATES) consentState?: ConsentState;
  @IsOptional() @IsEnum(['true', 'false']) hasListing?: 'true' | 'false';
  @IsOptional() @IsEnum(['not_sent', 'sent', 'confirmed']) notificationStatus?: 'not_sent' | 'sent' | 'confirmed';
  /** Table-header sort — 'name' | 'rating' | 'city' | 'listing' | 'notification' | 'consent',
   * optionally '-'-prefixed for descending. Any other/unknown value silently falls back to the
   * default order (see buildContactOrderBy). */
  @IsOptional() @IsString() sort?: string;
}

export class OutreachContactInputDto {
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() cityId?: string;
  @IsOptional() @IsString() areaId?: string;
  @IsOptional() @IsNumber() googleRating?: number;
  @IsOptional() @IsInt() googleReviewCount?: number;
  @IsOptional() @IsString() googlePlaceId?: string;
  @IsOptional() @IsString() businessCategory?: string;
  @IsOptional() @IsString() businessStatus?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() placesFetchLogId?: string;
  @IsOptional() @IsEnum(CONTACT_SOURCES) source?: ContactSource;
  @IsOptional() @IsString() sourceRef?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(CONSENT_STATES) consentState?: ConsentState;
  @IsOptional() @IsString() consentSource?: string;
}

export class CreateOutreachContactDto extends OutreachContactInputDto {
  @IsEnum(CONTACT_SOURCES) declare source: ContactSource;
}

export class ImportOutreachContactsDto {
  @IsEnum(CONTACT_SOURCES) source!: ContactSource;
  @IsOptional() @IsString() sourceRef?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutreachContactInputDto)
  contacts!: OutreachContactInputDto[];
}

export class AudienceFilterDto implements CampaignAudienceFilter {
  @IsOptional() @IsArray() @IsString({ each: true }) cityIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) businessCategories?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsNumber() @Min(0) @Max(5) minRating?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) statuses?: never;
}

export class CreateOutreachCampaignDto {
  @IsString() name!: string;
  @IsEnum(CHANNELS) channel!: OutreachChannel;
  @IsString() bodyTemplate!: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() dltTemplateId?: string;
  @IsOptional() @IsObject() audienceFilter?: CampaignAudienceFilter;
  @IsOptional() @IsString() cadenceCron?: string;
  @IsOptional() @IsString() scheduledAt?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10_000) maxSendsPerRun?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) minDaysBetweenSends?: number;
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

export class UpdateOutreachCampaignDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(CHANNELS) channel?: OutreachChannel;
  @IsOptional() @IsEnum(CAMPAIGN_STATUSES) status?: CampaignStatus;
  @IsOptional() @IsString() bodyTemplate?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() dltTemplateId?: string;
  @IsOptional() @IsObject() audienceFilter?: CampaignAudienceFilter;
  @IsOptional() @IsString() cadenceCron?: string;
  @IsOptional() @IsString() scheduledAt?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10_000) maxSendsPerRun?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) minDaysBetweenSends?: number;
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

export class ListCampaignSendsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 25;

  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() contactId?: string;
}

export class ListOutreachCampaignsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 25;
}

export class OptOutDto {
  @IsOptional() @IsString() reason?: string;
}

export class FetchedPairsQueryDto {
  @IsString() citySearched!: string;
  @IsOptional() @IsString() cityId?: string;
}

export class ListPlacesFetchLogDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 25;

  @IsOptional() @IsString() cityId?: string;
  @IsOptional() @IsString() businessCategory?: string;
}

export class CreatePlacesFetchLogDto {
  @IsString() citySearched!: string;
  @IsOptional() @IsString() cityId?: string;
  @IsOptional() @IsString() areaSearched?: string;
  @IsOptional() @IsString() areaId?: string;
  @IsString() businessCategory!: string;
  @IsString() queryPrefix!: string;
  @IsString() query!: string;
  @IsOptional() @IsNumber() minRatingFilter?: number;
}

export class UpdatePlacesFetchLogCountsDto {
  @IsInt() @Min(0) resultsFound!: number;
  @IsInt() @Min(0) resultsImported!: number;
}
