import { IsIn } from 'class-validator';
import type { ListingStatus } from '@bhavano/types';

const STATUSES: ListingStatus[] = ['active', 'sold', 'rented', 'deactivated'];

export class SetListingStatusDto {
  @IsIn(STATUSES)
  status!: ListingStatus;
}
