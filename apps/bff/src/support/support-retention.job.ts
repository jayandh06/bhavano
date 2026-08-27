import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../storage/r2-storage.service';

const RETENTION_DAYS = 90;

/** Attachments are user-submitted content held only long enough to resolve a ticket. Without
 * this, an endpoint anyone can upload to accumulates storage forever. The ticket text itself is
 * kept — it's small, and it's what makes issue trends readable over time. */
@Injectable()
export class SupportRetentionJob {
  private readonly logger = new Logger(SupportRetentionJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: R2StorageService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredAttachments(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const expired = await this.prisma.supportAttachment.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, r2Key: true },
    });
    if (expired.length === 0) return;

    let deleted = 0;
    for (const attachment of expired) {
      try {
        await this.storage.deleteObject(attachment.r2Key);
        await this.prisma.supportAttachment.delete({
          where: { id: attachment.id },
        });
        deleted++;
      } catch (error) {
        // Leave the row in place so the next run retries it rather than orphaning the object.
        this.logger.error(
          `Failed to purge ${attachment.r2Key}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    this.logger.log(
      `Purged ${deleted}/${expired.length} support attachments older than ${RETENTION_DAYS} days`,
    );
  }
}
