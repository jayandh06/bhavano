import { Body, Controller, HttpCode, Headers, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { CreateBoostOrderResponseDto } from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { PaymentsService } from './payments.service';
import { CreateBoostOrderDto } from './dto/create-boost-order.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders')
  @UseGuards(AuthGuard)
  createOrder(@Body() dto: CreateBoostOrderDto, @CurrentUser() user: RequestUser): Promise<CreateBoostOrderResponseDto> {
    return this.paymentsService.createBoostOrder(user.id, dto.listingId, dto.boostDays);
  }

  /** Public (no AuthGuard) — Razorpay calls this server-to-server, authenticated by HMAC
   * signature instead of a Bearer token. Needs the exact raw body (see main.ts's
   * `rawBody: true`), not the JSON-parsed one, to verify that signature. */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string): Promise<{ success: true }> {
    await this.paymentsService.handleWebhook(req.rawBody ?? Buffer.from(''), signature);
    return { success: true };
  }
}
