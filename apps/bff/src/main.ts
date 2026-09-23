import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true — the Razorpay webhook needs the exact raw request body (as `req.rawBody`,
  // a Buffer) to verify its HMAC signature; the parsed/re-serialized req.body wouldn't
  // byte-for-byte match what Razorpay signed.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  // Behind exactly one reverse proxy in production (Caddy — no CDN sits in front of it; the
  // Cloudflare config elsewhere in this app is only for R2 photo storage, not request proxying).
  // The numeric form trusts exactly that many hops and resolves req.ip to the address that hop
  // added, i.e. the one Caddy itself appends — NOT `true`, which trusts every hop and takes the
  // leftmost entry in X-Forwarded-For, fully spoofable by whoever sent the request. See
  // middleware.ts's own clientIp() (web), which works around the same problem by hand for
  // exactly this reason, and docs/plans/safely-reactivate-bff-throttling.md.
  app.set('trust proxy', 1);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
