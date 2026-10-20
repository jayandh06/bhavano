import { IsString, Matches, MaxLength } from 'class-validator';

// "1.2.0", "1.2" or "1" — or empty for no minimum. Mirrors APP_VERSION_PATTERN in @bhavano/types.
const VERSION_OR_EMPTY = /^(\d{1,4}(\.\d{1,4}){0,2})?$/;

export class UpdateAppVersionSettingsDto {
  @IsString()
  @Matches(VERSION_OR_EMPTY, { message: 'androidMinVersion must look like 1.2.0, or be empty' })
  androidMinVersion!: string;

  @IsString()
  @Matches(VERSION_OR_EMPTY, { message: 'iosMinVersion must look like 1.2.0, or be empty' })
  iosMinVersion!: string;

  @IsString()
  @MaxLength(200)
  message!: string;
}
