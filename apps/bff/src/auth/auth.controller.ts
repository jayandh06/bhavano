import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthSession } from '@bhavano/types';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { RequestUser } from './guards/auth.guard';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleLoginDto } from './dto/google-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async sendOtp(@Body() dto: SendOtpDto): Promise<{ success: true }> {
    await this.authService.sendOtp(dto.phone);
    return { success: true };
  }

  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<AuthSession> {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Post('google')
  @HttpCode(200)
  loginWithGoogle(@Body() dto: GoogleLoginDto): Promise<AuthSession> {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @Post('otp/link')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async linkPhone(@Body() dto: VerifyOtpDto, @CurrentUser() user: RequestUser): Promise<{ success: true }> {
    await this.authService.linkPhone(user.id, dto.phone, dto.code);
    return { success: true };
  }
}
