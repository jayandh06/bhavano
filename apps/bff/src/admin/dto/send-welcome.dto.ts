import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString } from 'class-validator';
import type { WelcomeChannel } from '@bhavano/types';

const WELCOME_CHANNELS: WelcomeChannel[] = ['email', 'whatsapp'];

export class SendWelcomeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  userIds!: string[];

  @IsIn(WELCOME_CHANNELS)
  channel!: WelcomeChannel;
}
