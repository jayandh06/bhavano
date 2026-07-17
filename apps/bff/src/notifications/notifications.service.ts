import { Injectable } from '@nestjs/common';
import type { ListingDetailDto } from '@bhavano/types';
import { Msg91Provider } from '../auth/providers/msg91.provider';
import { EmailProvider } from './providers/email.provider';

interface NotifiableUser {
  email: string | null;
  phone: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly emailProvider: EmailProvider,
    private readonly msg91: Msg91Provider,
  ) {}

  async notifyListingFlagged(user: NotifiableUser, listing: ListingDetailDto, message: string): Promise<void> {
    const subject = `Action needed: your listing "${listing.title}" has been taken offline`;
    const body =
      `Hi, one of your listings ("${listing.title}") has been taken offline by a Bhavano moderator:\n\n` +
      `"${message}"\n\n` +
      `Please review and update your listing, then it will be reviewed again. ` +
      `You can reply to the moderator directly from the Messages section of your account.`;

    await this.dispatch(user, subject, body);
  }

  async notifyListingApproved(user: NotifiableUser, listing: ListingDetailDto): Promise<void> {
    const subject = `Your listing "${listing.title}" is live again`;
    const body = `Good news — your listing "${listing.title}" has been reviewed and is live again on Bhavano.`;

    await this.dispatch(user, subject, body);
  }

  private async dispatch(user: NotifiableUser, subject: string, body: string): Promise<void> {
    await Promise.all([
      user.email ? this.emailProvider.send(user.email, subject, body) : Promise.resolve(),
      user.phone ? this.msg91.sendTransactionalSms(user.phone, body) : Promise.resolve(),
    ]);
  }
}
