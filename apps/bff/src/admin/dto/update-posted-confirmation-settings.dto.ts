import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_POSTED_CONFIRMATION_DELAY_MINUTES } from '../../listings/posted-confirmation-settings';

export class UpdatePostedConfirmationSettingsDto {
  /** Minutes the "your ad is posted" email/WhatsApp waits for the seller to finish the Featured
   * offer. 0 sends it at post time. Capped at a day: a typo must not hold every confirmation back
   * for days. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_POSTED_CONFIRMATION_DELAY_MINUTES)
  delayMinutes!: number;
}
