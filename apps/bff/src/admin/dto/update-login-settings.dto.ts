import { IsIn } from 'class-validator';
import {
  EMAIL_LOGIN_MODES,
  PHONE_REQUIREMENT_MODES,
  type EmailLoginMode,
  type PhoneRequirementMode,
} from '@bhavano/types/loginSettings';

export class UpdateLoginSettingsDto {
  @IsIn(EMAIL_LOGIN_MODES as readonly string[])
  emailLogin!: EmailLoginMode;

  @IsIn(PHONE_REQUIREMENT_MODES as readonly string[])
  phoneRequirement!: PhoneRequirementMode;
}
