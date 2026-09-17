import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/** Only what the seeker owns. The criteria are deliberately absent: they were captured from a
 * real search, an admin may already have worked the queue against them, and letting them drift
 * afterwards would mean the requirement no longer matches what anybody was told about. Someone
 * whose needs changed should post a new one. */
export class UpdateMyRequirementDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsDateString()
  moveInBy?: string;
}
