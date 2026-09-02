import { IsInt, Max, Min } from 'class-validator';

/** How many additional 90° clockwise turns to apply on top of the photo's current rotation, in
 * one save — not "rotate once more," which is what forced every single click in a naive UI's
 * local preview to trigger its own separate reprocess round trip. Shared by the admin and owner
 * rotate routes (AdminController, ListingsController) — see
 * docs/plans/listing-photo-orientation.md. */
export class RotatePhotoDto {
  @IsInt()
  @Min(1)
  @Max(3)
  turns!: number;
}
