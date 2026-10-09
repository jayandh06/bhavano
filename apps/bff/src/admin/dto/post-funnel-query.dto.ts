import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { POST_ENTRY_SOURCES } from '@bhavano/types/postEntry';

const PLATFORM_VALUES = ['web', 'app'] as const;
export type PostFunnelPlatform = (typeof PLATFORM_VALUES)[number];

const LOGGED_IN_VALUES = ['yes', 'no'] as const;
export type PostFunnelLoggedIn = (typeof LOGGED_IN_VALUES)[number];

/** `from`/`to` arrive as full ISO strings with an offset already applied by the admin page, same
 * convention as ListPageVisitsDto. */
export class PostFunnelQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /** Which on-site link sent the visitor to `/post` — see
   * packages/types/src/postEntry.ts. Omit for every entry source combined. */
  @IsOptional()
  @IsIn(POST_ENTRY_SOURCES)
  entry?: string;

  @IsOptional()
  @IsIn(PLATFORM_VALUES)
  platform?: PostFunnelPlatform;

  /** Whether the visitor was already signed in when they reached `/post` — as opposed to
   * `post_login_required`, which is whether the login wall was hit partway through. */
  @IsOptional()
  @IsIn(LOGGED_IN_VALUES)
  loggedIn?: PostFunnelLoggedIn;
}
