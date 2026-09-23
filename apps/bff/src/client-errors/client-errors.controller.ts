import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { ClientErrorsService } from './client-errors.service';
import { CreateClientErrorDto } from './dto/create-client-error.dto';

@Controller('client-errors')
export class ClientErrorsController {
  constructor(private readonly clientErrors: ClientErrorsService) {}

  /** Public, unauthenticated — a UI crash can happen before login, or while the login itself is
   * broken. Throttled well below the app-wide default: a real repeated-crash loop from one
   * visitor is still generous at 10/min, and there's no legitimate reason for one IP to report
   * more than that. See docs/plans/client-error-reporting-loki-grafana.md for why this needed
   * ThrottlerGuard actually bound (app.module.ts) to mean anything at all. */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(204)
  record(@Body() dto: CreateClientErrorDto, @Req() req: Request): void {
    this.clientErrors.record(dto, req.ip);
  }
}
