import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
  providers: [
    AppService,
    // Activates every @Throttle() decorator in the codebase — ThrottlerModule.forRoot() only
    // registers the default limit/storage, it does not bind the guard that actually enforces it.
    // Confirmed missing entirely before this: no APP_GUARD, no per-route @UseGuards(ThrottlerGuard),
    // so every existing @Throttle() (auth OTP send/verify, analytics, requirements, support, users)
    // was decorative only. See docs/plans/client-error-reporting-loki-grafana.md.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
