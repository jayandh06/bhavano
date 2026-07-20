import { ArgumentsHost, Catch, Injectable } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Request } from 'express';
import type { RequestUser } from '../auth/guards/auth.guard';

/** Prisma's own error codes are always `P` + 4 digits (e.g. P2007 for a bad enum value — see the
 * `plot`/`commercial` migration incident this was built to catch). Duck-typed rather than
 * `instanceof PrismaClientKnownRequestError` so this doesn't need a direct Prisma import here. */
function prismaCodeOf(exception: unknown): string | undefined {
  const code = (exception as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
}

/** Catches anything that escapes normal request handling and logs it (level "error", full stack,
 * correlation/user context, Prisma error code if applicable) before delegating to Nest's own
 * `BaseExceptionFilter` — this only adds logging, the client-facing error response is completely
 * unchanged. Registered as a global APP_FILTER in LoggingModule. */
@Injectable()
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(
    httpAdapterHost: HttpAdapterHost,
    @InjectPinoLogger(AllExceptionsFilter.name) private readonly logger: PinoLogger,
  ) {
    super(httpAdapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request & { user?: RequestUser; id?: string }>();

    this.logger.error(
      {
        err: exception,
        reqId: request.id,
        userId: request.user?.id ?? null,
        method: request.method,
        path: request.url,
        prismaCode: prismaCodeOf(exception),
      },
      'Unhandled exception',
    );

    super.catch(exception, host);
  }
}
