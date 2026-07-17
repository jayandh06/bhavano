import { IsInt, Min } from 'class-validator';

export class UpdateRateLimitsDto {
  @IsInt()
  @Min(1)
  publishLimit!: number;

  @IsInt()
  @Min(1)
  publishWindowMinutes!: number;

  @IsInt()
  @Min(1)
  viewLimit!: number;

  @IsInt()
  @Min(1)
  viewWindowMinutes!: number;
}
