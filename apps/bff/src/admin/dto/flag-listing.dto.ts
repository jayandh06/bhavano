import { IsString, MinLength } from 'class-validator';

export class FlagListingDto {
  @IsString()
  @MinLength(3)
  message!: string;
}
