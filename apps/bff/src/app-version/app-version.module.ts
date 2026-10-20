import { Module } from '@nestjs/common';
import { AppVersionAdminController, AppVersionPublicController } from './app-version.controller';
import { AppVersionService } from './app-version.service';

@Module({
  controllers: [AppVersionPublicController, AppVersionAdminController],
  providers: [AppVersionService],
})
export class AppVersionModule {}
