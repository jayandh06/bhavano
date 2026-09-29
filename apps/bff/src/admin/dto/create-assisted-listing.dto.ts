import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { SellerType } from '@bhavano/types';
import { CreateListingDto } from '../../listings/dto/create-listing.dto';

/** POST /admin/listings/assisted — the wizard's own create body plus who the ad is for.
 * `postedAs` keeps the parent's optional validation (class-validator inherits @IsOptional), so
 * ListingsService.createAssisted rejects a missing one. */
export class CreateAssistedListingDto extends CreateListingDto {
  /** Indian mobile, optionally with +91 / 0 and spaces; normalised by toE164India. */
  @IsString()
  @Matches(/^[+\d\s-]{10,16}$/)
  claimPhone!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  claimName!: string;

  declare postedAs: SellerType;
}
