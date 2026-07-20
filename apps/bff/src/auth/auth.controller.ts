import { Body, Controller, HttpCode, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthSession } from '@bhavano/types';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { RequestUser } from './guards/auth.guard';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { DevLoginDto } from './dto/dev-login.dto';

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

  /** Test-only: mints a real session for an existing (seeded) user without going through OTP
   * or Google — used by the web app's Playwright smoke suite (see docs/plans/web-smoke-tests.md).
   * Double-gated so it can never be reachable outside a local/test run, even on a misconfigured
   * non-prod deploy. */
  @Post('dev-login')
  @HttpCode(200)
  devLogin(@Body() dto: DevLoginDto): Promise<AuthSession> {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_LOGIN !== 'true') {
      throw new NotFoundException();
    }
    return this.authService.devLogin(dto.phone);
  }

  @Post('otp/link')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async linkPhone(@Body() dto: VerifyOtpDto, @CurrentUser() user: RequestUser): Promise<{ success: true }> {
    await this.authService.linkPhone(user.id, dto.phone, dto.code);
    return { success: true };
  }

  /** No server-side session to end (JWTs are stateless/short-lived) — this exists purely to give
   * the BFF a logout signal to log, since apps/web|admin's own signOutAction otherwise clears the
   * NextAuth cookie without ever calling the BFF. See docs/plans/bff-loki-grafana-logging.md. */
  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  logout(@CurrentUser() user: RequestUser): { success: true } {
    this.authService.logout(user.id);
    return { success: true };
  }
}
