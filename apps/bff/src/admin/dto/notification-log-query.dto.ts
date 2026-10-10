import { IsDateString, IsOptional } from 'class-validator';

/** `from`/`to` arrive as full ISO strings with an offset already applied by the admin page, same
 * convention as ListPageVisitsDto/PostFunnelQueryDto. */
export class NotificationLogQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
