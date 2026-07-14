import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { Msg91Provider } from './providers/msg91.provider';
import { GoogleProvider } from './providers/google.provider';

@Module({
  controllers: [AuthController],
  providers: [AuthService, OtpService, Msg91Provider, GoogleProvider],
})
export class AuthModule {}
