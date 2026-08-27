import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RequestEmailCodeDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  @Length(1, 200)
  email!: string;
}

export class VerifyEmailDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  @Length(1, 200)
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}
