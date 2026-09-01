import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class PushTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  token!: string;

  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}

export class DeletePushTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  token!: string;
}
