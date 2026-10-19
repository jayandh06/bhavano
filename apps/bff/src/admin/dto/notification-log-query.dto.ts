import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

/** `from`/`to` arrive as full ISO strings with an offset already applied by the admin page, same
 * convention as ListPageVisitsDto/PostFunnelQueryDto. `channel`/`kind`/`userId` narrow both the
 * daily-summary counts and the per-day detail rows to a single channel, notification kind, or
 * recipient — see AdminService.getNotificationDailySummary/getNotificationDayDetail. `kind` has
 * no fixed enum here (unlike `channel`) because nothing in the codebase centralizes the kind
 * strings each notification call site logs under; valid values come from
 * AdminService.getNotificationKinds instead of being hardcoded. */
export class NotificationLogQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['email', 'whatsapp', 'push', 'in_app'])
  channel?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
