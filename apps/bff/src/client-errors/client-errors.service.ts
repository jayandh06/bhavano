import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { logClientError } from '../logging/clientErrorLogger';
import type { CreateClientErrorDto } from './dto/create-client-error.dto';

@Injectable()
export class ClientErrorsService {
  constructor(@InjectPinoLogger(ClientErrorsService.name) private readonly logger: PinoLogger) {}

  /** `fallbackIp` is `req.ip` — used only when the caller didn't forward one of their own (see
   * `CreateClientErrorDto.ip`'s own doc comment for why a Server-Action-proxied call needs to). */
  record(dto: CreateClientErrorDto, fallbackIp: string | undefined): void {
    logClientError({
      logger: this.logger,
      app: dto.app,
      message: dto.message,
      stack: dto.stack,
      componentStack: dto.componentStack,
      url: dto.url,
      digest: dto.digest,
      userAgent: dto.userAgent,
      appVersion: dto.appVersion,
      userId: dto.userId,
      ip: dto.ip ?? fallbackIp,
    });
  }
}
