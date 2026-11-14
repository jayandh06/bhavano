import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { POST_ENTRY_SOURCES } from '@bhavano/types/postEntry';

const PLATFORM_VALUES = ['web', 'app'] as const;
export type PostFunnelPlatform = (typeof PLATFORM_VALUES)[number];

const LOGGED_IN_VALUES = ['yes', 'no'] as const;
export type PostFunnelLoggedIn = (typeof LOGGED_IN_VALUES)[number];

/** `india` keeps sessions whose IP geolocates to India; `other` is the complement (every other country,
 * and sessions with no geolocation), so the two always add up to "all". See docs/plans/post-ad-simpler-form.md
 * section 2c for why: much of `/post`'s non-Indian traffic never chooses a category. */
const COUNTRY_VALUES = ['india', 'other'] as const;
export type PostFunnelCountry = (typeof COUNTRY_VALUES)[number];

/** Which Details form the visitor was given: the original (`v1`), the redesign (`v2`) or the step-by-step page (`v3`), as written into every funnel step as `form=`.
 * Sessions from before that was recorded have neither, so a variant filter leaves them out. See docs/plans/post-ad-simpler-form.md. */
const VARIANT_VALUES = ['v1', 'v2', 'v3'] as const;
export type PostFunnelVariant = (typeof VARIANT_VALUES)[number];

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

  /** Where the visit's IP geolocates (`Visit.ipCountry`). Omit for every country combined. */
  @IsOptional()
  @IsIn(COUNTRY_VALUES)
  country?: PostFunnelCountry;

  /** Which Details form version the session saw. Omit for both (and for sessions that predate the split). */
  @IsOptional()
  @IsIn(VARIANT_VALUES)
  variant?: PostFunnelVariant;
}
