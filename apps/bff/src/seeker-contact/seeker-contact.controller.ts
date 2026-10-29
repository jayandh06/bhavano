import { Controller, Get } from '@nestjs/common';
import type { SeekerContactSettingsDto } from '@bhavano/types/seekerContact';
import { PrismaService } from '../prisma/prisma.service';
import { getSeekerContactSettings } from './seeker-contact-settings';

/** Public: the website reads whether the feature is on (to show the notice). Only switches, nothing about any person. */
@Controller('seeker-contact')
export class SeekerContactController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('settings')
  settings(): Promise<SeekerContactSettingsDto> {
    return getSeekerContactSettings(this.prisma);
  }
}
