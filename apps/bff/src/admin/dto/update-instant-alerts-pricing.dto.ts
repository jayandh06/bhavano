import { IsInt, Min } from 'class-validator';

export class UpdateInstantAlertsPricingDto {
  @IsInt()
  @Min(1)
  instantAlertsPrice!: number;
}
