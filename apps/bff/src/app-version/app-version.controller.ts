import { Body, Controller, Get, Header, Patch, UseGuards } from '@nestjs/common';
import type { AppVersionSettingsDto } from '@bhavano/types/appVersion';
import { AdminGuard } from '../auth/guards/auth.guard';
import { AppVersionService } from './app-version.service';
import { UpdateAppVersionSettingsDto } from './dto/update-app-version-settings.dto';

/** Public: the app reads this at launch, before anyone is logged in. */
@Controller('app-config')
export class AppVersionPublicController {
  constructor(private readonly appVersion: AppVersionService) {}

  @Get('version')
  // Short, so a raised minimum takes effect within a minute, but a launch storm doesn't hit the DB.
  @Header('Cache-Control', 'public, max-age=60')
  getVersion(): Promise<AppVersionSettingsDto> {
    return this.appVersion.getSettings();
  }
}

@Controller('admin/app-version-settings')
@UseGuards(AdminGuard)
export class AppVersionAdminController {
  constructor(private readonly appVersion: AppVersionService) {}

  @Get()
  get(): Promise<AppVersionSettingsDto> {
    return this.appVersion.getSettings();
  }

  @Patch()
  update(@Body() dto: UpdateAppVersionSettingsDto): Promise<AppVersionSettingsDto> {
    return this.appVersion.updateSettings(dto);
  }
}
