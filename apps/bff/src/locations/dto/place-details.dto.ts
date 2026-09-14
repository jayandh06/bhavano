import { IsString, MinLength } from 'class-validator';

export class PlaceDetailsDto {
  @IsString()
  @MinLength(1)
  placeId!: string;
}
