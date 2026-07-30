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
import { AdminModule } from './admin/admin.module';
import { PhotoProcessingModule } from './photo-processing/photo-processing.module';
import { VideoProcessingModule } from './video-processing/video-processing.module';
import { LoggingModule } from './logging/logging.module';
import { PaymentsModule } from './payments/payments.module';
import { AgentsModule } from './agents/agents.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SellerJobsModule } from './seller-jobs/seller-jobs.module';
import { OutreachModule } from './outreach/outreach.module';

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
    AdminModule,
    PhotoProcessingModule,
    VideoProcessingModule,
    PaymentsModule,
    AgentsModule,
    SavedSearchesModule,
    AnalyticsModule,
    SellerJobsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
