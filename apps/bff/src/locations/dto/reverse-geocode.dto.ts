import { IsLatitude, IsLongitude } from 'class-validator';

export class ReverseGeocodeDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}
