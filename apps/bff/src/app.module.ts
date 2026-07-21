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
import { LoggingModule } from './logging/logging.module';
import { PaymentsModule } from './payments/payments.module';

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
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
