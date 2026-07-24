import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { GoogleProvider } from './providers/google.provider';
import { NotificationsModule } from '../notifications/notifications.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [NotificationsModule, AnalyticsModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, GoogleProvider],
})
export class AuthModule {}
