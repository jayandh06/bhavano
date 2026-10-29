import { IsBoolean } from 'class-validator';

export class UpdateOwnerAlertSettingsDto {
  @IsBoolean()
  whatsappForFreeAds!: boolean;

  @IsBoolean()
  smsForFreeAds!: boolean;
}
