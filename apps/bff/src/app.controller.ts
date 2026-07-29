import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Used by Docker healthchecks — verifies DB connectivity and that migrations match the
   * running Prisma client (selects columns added by recent migrations). */
  @Get('health')
  async health(): Promise<{ ok: true }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.prisma.user.findFirst({
        select: { id: true, agentProUnits: true, sellerSlotPackUntil: true },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Database is unreachable or schema is out of date — run `npx prisma migrate deploy` on the BFF container.',
      );
    }
    return { ok: true };
  }
}
