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
  // Behind Caddy in production — without this, req.ip resolves to Caddy's own container IP
  // instead of the real client IP carried in X-Forwarded-For.
  app.set('trust proxy', true);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
