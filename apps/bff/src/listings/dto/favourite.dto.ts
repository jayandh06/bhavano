import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class SetFavouriteDto {
  /** Omitted: toggle. Set: the state to end in, so a resumed or synced save can't un-save. */
  @IsOptional()
  @IsBoolean()
  favourite?: boolean;
}

/** Matches the device-save cap on web and app (GUEST_SAVES_MAX). */
export class ImportFavouritesDto {
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  listingIds!: string[];
}
