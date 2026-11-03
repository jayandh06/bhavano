import { IsIn, IsInt, IsString, Matches, MaxLength } from 'class-validator';

/** Body of POST /admin/listings/:id/grant-boost: free Featured days an admin gives one live ad. */
export class GrantBoostDto {
  @IsInt()
  @IsIn([7, 15, 30])
  days!: 7 | 15 | 30;

  /** Why, as a short code kept on the payment (`source: admin_grant:<reason>`), e.g. `pilot_pg`. */
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-z0-9_]+$/, { message: 'reason is lowercase letters, digits and underscores only' })
  reason!: string;
}
