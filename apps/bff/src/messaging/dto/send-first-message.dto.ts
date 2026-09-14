import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendFirstMessageDto {
  @IsString()
  listingId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
