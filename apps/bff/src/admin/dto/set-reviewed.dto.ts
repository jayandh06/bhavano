import { IsBoolean } from 'class-validator';

export class SetReviewedDto {
  @IsBoolean()
  adminReviewed!: boolean;
}
