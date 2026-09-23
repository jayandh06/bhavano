import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ListingsModule } from './listings/listings.module';
import { LocationsModule } from './locations/locations.module';
import { AuthModule } from './auth/auth.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { MessagingModule } from './messaging/messaging.module';
import { PushModule } from './push/push.module';
import { AdminModule } from './admin/admin.module';
import { PhotoProcessingModule } from './photo-processing/photo-processing.module';
import { VideoProcessingModule } from './video-processing/video-processing.module';
import { PaymentsModule } from './payments/payments.module';
import { AgentsModule } from './agents/agents.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { RequirementsModule } from './requirements/requirements.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SellerJobsModule } from './seller-jobs/seller-jobs.module';
import { OutreachModule } from './outreach/outreach.module';
import { SupportModule } from './support/support.module';
import { PlansModule } from './plans/plans.module';
import { ClientErrorsModule } from './client-errors/client-errors.module';
// LoggingModule's import MUST be the last one in this file, not just last in the `imports:`
// array below — nestjs-pino's LoggerModule.forRootAsync() snapshots every @InjectPinoLogger(...)
// context name SYNCHRONOUSLY, the moment this import statement runs (see
// createProvidersForDecorated() in nestjs-pino's InjectPinoLogger.js), not lazily during Nest's
// own bootstrap. A class using @InjectPinoLogger that gets require()'d only *after* this import
// (transitively, via any module imported below this line) would silently miss that snapshot and
// throw UnknownDependenciesException at boot — reproduced with a fresh ClientErrorsService this
// session. Keeping this import last means every other module's classes are guaranteed to have
// already been evaluated (and their @InjectPinoLogger decorators already run) by the time this
// line executes. See docs/plans/client-error-reporting-loki-grafana.md.
import { LoggingModule } from './logging/logging.module';

@Module({
  imports: [
    LoggingModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    PrismaModule,
    ListingsModule,
    LocationsModule,
    AuthModule,
    UploadsModule,
    UsersModule,
    MessagingModule,
    PushModule,
    AdminModule,
    PhotoProcessingModule,
    VideoProcessingModule,
    PaymentsModule,
    AgentsModule,
    SavedSearchesModule,
    RequirementsModule,
    AnalyticsModule,
    SellerJobsModule,
    SupportModule,
    PlansModule,
    ClientErrorsModule,
  ],
  controllers: [AppController],
  // NOT bound globally via APP_GUARD: that applies ThrottlerModule.forRoot()'s default limit
  // (20/60s) to *every* route with no @Throttle()/@SkipThrottle() of its own, including plain
  // reads like /listings, /locations/cities, /plans/pricing — hit within seconds by web/admin's
  // own SSR traffic, since every Server-Action-proxied call to this BFF shares one source IP (the
  // web/admin container's), not the real visitor's. Caused a real production outage the first
  // time this was tried (see docs/plans/client-error-reporting-loki-grafana.md's "Implementation
  // notes"). Instead, `@UseGuards(ThrottlerGuard)` is added on exactly the methods that already
  // carry `@Throttle(...)`, so only those opted-in routes are ever guarded — never made global.
  providers: [AppService],
})
export class AppModule {}
