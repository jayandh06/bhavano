import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RequestUser } from '../auth/guards/auth.guard';
import { AllExceptionsFilter } from './all-exceptions.filter';

type RequestWithUser = IncomingMessage & { user?: RequestUser };

/** IST is a fixed UTC+5:30 offset with no DST, so this needs no timezone-database dependency —
 * this is an India-only platform, every log timestamp should read in IST, not pino's default UTC. */
function istTimestamp(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return `,"time":"${ist.toISOString().replace('Z', '+05:30')}"`;
}

/** Global request/response logging for the BFF — every request gets one structured JSON line
 * (method, path, status, duration, userId, ip, user-agent) via `pino-http`, written
 * asynchronously (see the `transport` below) so logging never blocks request handling. See
 * docs/plans/bff-loki-grafana-logging.md for the full design. */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: () => ({
        pinoHttp: {
          base: { service: 'bff' },
          timestamp: istTimestamp,
          // Reuses an incoming x-request-id if a future caller ever sends one, else mints a
          // fresh one — echoed back as a response header for client-side correlation.
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const header = req.headers['x-request-id'];
            const id = (Array.isArray(header) ? header[0] : header) ?? randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          // Safe to read req.user here even though this runs as middleware (before guards in
          // Nest's pipeline) — pino-http only *evaluates* this when it builds the completion log
          // line on `res.on('finish')`, which fires after the route's guards/handler already ran
          // and populated req.user (see AuthGuard/OptionalAuthGuard). Public routes with no guard
          // simply log userId/role as null — expected, not a bug.
          customProps: (req: RequestWithUser) => ({
            userId: req.user?.id ?? null,
            role: req.user?.role ?? null,
          }),
          customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },
          // Defense-in-depth on top of never logging request/response bodies at all.
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          transport:
            process.env.NODE_ENV === 'production'
              ? {
                  // Rotation, not just a single ever-growing file — daily or every 20MB,
                  // whichever comes first. Written on pino's own worker thread, so this never
                  // blocks the request-handling event loop (the "asynchronous" requirement).
                  target: 'pino-roll',
                  options: {
                    file: '/app/apps/bff/logs/bff',
                    frequency: 'daily',
                    size: '20m',
                    mkdir: true,
                    extension: '.log',
                  },
                }
              : // Dev: bff isn't containerized (see docker-compose.yml), so there's no shared
                // volume to write into — just pretty-print to stdout like Nest's default logger.
                { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
        },
      }),
    }),
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class LoggingModule {}
