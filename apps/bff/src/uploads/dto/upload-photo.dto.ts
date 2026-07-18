import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class UploadPhotoDto {
  @IsUUID()
  listingId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  photoNo!: number;
}
