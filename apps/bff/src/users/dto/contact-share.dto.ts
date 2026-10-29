import { IsBoolean } from 'class-validator';

/** true = owners of Featured ads I show interest in may call me; false = they may not. */
export class UpdateContactShareDto {
  @IsBoolean()
  sharing!: boolean;
}
