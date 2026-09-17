import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Mirrors Payment.purpose (schema.prisma) — kept here rather than imported from the Prisma
 * client so this DTO's validation doesn't depend on the generated client's own enum export. */
const ADMIN_PAYMENT_PURPOSE_VALUES = [
  'listing_boost',
  'buyer_premium',
  'agent_pro',
  'seller_slot_pack',
  'contact_reveal_credits',
  'instant_alerts',
] as const;

export type AdminPaymentPurposeFilter = (typeof ADMIN_PAYMENT_PURPOSE_VALUES)[number];

/** Mirrors Payment.status. */
const ADMIN_PAYMENT_STATUS_VALUES = ['created', 'paid', 'failed', 'refunded'] as const;

export type AdminPaymentStatusFilter = (typeof ADMIN_PAYMENT_STATUS_VALUES)[number];

/** `expiresAt` is deliberately absent — see AdminPaymentDto's own doc comment on why it can't be
 * an orderBy target (it's resolved from whichever of four different related tables this
 * payment's purpose populated, not a column on Payment itself). `paidAt` sorts nulls last in
 * both directions, same as every nullable sort column elsewhere in this admin app — a payment
 * that never got paid is never the most interesting row to lead with either way. */
const ADMIN_PAYMENT_SORT_VALUES = [
  'createdAt_desc',
  'createdAt_asc',
  'paidAt_desc',
  'paidAt_asc',
  'amount_desc',
  'amount_asc',
  'status_desc',
  'status_asc',
  'purpose_desc',
  'purpose_asc',
  'user_desc',
  'user_asc',
  'listing_desc',
  'listing_asc',
] as const;

export type AdminPaymentSort = (typeof ADMIN_PAYMENT_SORT_VALUES)[number];

export { ADMIN_PAYMENT_PURPOSE_VALUES, ADMIN_PAYMENT_STATUS_VALUES, ADMIN_PAYMENT_SORT_VALUES };

/** `listingTitle` uses the same text-filter DSL as ListPageVisitsDto's free-text columns (parsed
 * by `parseTextFilter` in admin.service.ts): plain text is a case-insensitive `contains`,
 * `x%`/`%x` anchor to start/end, `{a, b}` is an exact IN, and a leading `!` negates. */
export class ListPaymentsDto {
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
  userId?: string;

  @IsOptional()
  @IsIn(ADMIN_PAYMENT_PURPOSE_VALUES)
  purpose?: AdminPaymentPurposeFilter;

  @IsOptional()
  @IsIn(ADMIN_PAYMENT_STATUS_VALUES)
  status?: AdminPaymentStatusFilter;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  listingTitle?: string;

  @IsOptional()
  @IsIn(ADMIN_PAYMENT_SORT_VALUES)
  sort?: AdminPaymentSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}
