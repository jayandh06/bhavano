import { IsBoolean } from 'class-validator';

export class SetReraVerifiedDto {
  @IsBoolean()
  verified!: boolean;
}
