import { IsIn } from 'class-validator';
import { EMAIL_LOGIN_MODES, type EmailLoginMode } from '@bhavano/types/loginSettings';

export class UpdateLoginSettingsDto {
  @IsIn(EMAIL_LOGIN_MODES as readonly string[])
  emailLogin!: EmailLoginMode;
}
