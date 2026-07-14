import { IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a 10-digit Indian mobile number' })
  phone!: string;
}
