import { ArrayMaxSize, IsArray, IsIn } from 'class-validator';
import { OWNER_ALERT_CHANNELS } from '@bhavano/types/ownerAlerts';

/** The channels in the order to try them. May list fewer than all four (the rest are appended in the default order); unknown names are rejected. */
export class UpdateAlertPreferenceDto {
  @IsArray()
  @ArrayMaxSize(OWNER_ALERT_CHANNELS.length)
  @IsIn(OWNER_ALERT_CHANNELS as readonly string[], { each: true })
  channels!: string[];
}
