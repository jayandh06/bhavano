import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class SendPostedNotificationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  listingIds!: string[];
}
