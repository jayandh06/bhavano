import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const ADMIN_CONVERSATION_TYPES = ['inquiry', 'moderation', 'announcement', 'any'] as const;
export type AdminConversationTypeFilter = (typeof ADMIN_CONVERSATION_TYPES)[number];

/** Filters for the admin Messages screen (GET /admin/conversations). */
export class ListAdminConversationsDto {
  /** Defaults to buyer enquiries, the thing "who messaged whom" usually means; `any` includes staff threads. */
  @IsOptional()
  @IsIn(ADMIN_CONVERSATION_TYPES)
  type?: AdminConversationTypeFilter;

  /** Started on or after this instant (the admin page sends IST day bounds). */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /** Either party: the buyer or the listing's owner. */
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  listingId?: string;

  /** Text search over either party's name, phone or email, and the listing title. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

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
