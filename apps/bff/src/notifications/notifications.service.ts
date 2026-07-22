import { Injectable } from '@nestjs/common';
import type { ListingDetailDto } from '@bhavano/types';
import { Msg91Provider } from './providers/msg91.provider';
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

  async notifyListingFlagged(
    user: NotifiableUser,
    listing: ListingDetailDto,
    message: string,
  ): Promise<void> {
    const subject = `Action needed: your listing "${listing.title}" has been taken offline`;
    const body =
      `Hi, one of your listings ("${listing.title}") has been taken offline by a Bhavano moderator:\n\n` +
      `"${message}"\n\n` +
      `Please review and update your listing, then it will be reviewed again. ` +
      `You can reply to the moderator directly from the Messages section of your account.`;

    await this.dispatch(user, subject, body);
  }

  async notifyListingApproved(
    user: NotifiableUser,
    listing: ListingDetailDto,
  ): Promise<void> {
    const subject = `Your listing "${listing.title}" is live again`;
    const body = `Good news — your listing "${listing.title}" has been reviewed and is live again on Bhavano.`;

    await this.dispatch(user, subject, body);
  }

  /** A boost perk, not a universal notification — see ListingsService.toggleFavourite, which
   * only fires this while the listing is currently boosted. Unboosted listings can rack up many
   * casual likes with no real intent behind most of them; boosted ads are a much smaller, more
   * engaged set where "someone just liked your ad" is a meaningful, non-spammy signal. */
  async notifyListingLiked(
    user: NotifiableUser,
    listingTitle: string,
    likerName: string,
  ): Promise<void> {
    const subject = `${likerName} liked your boosted ad`;
    const body = `${likerName} just added your listing "${listingTitle}" to their favourites on Bhavano.`;

    await this.dispatch(user, subject, body);
  }

  /** Bhavano Plus's early-access alerts — the proactive counterpart to a buyer having to keep
   * re-checking browse pages themselves. See SavedSearchesService.notifyMatchingBuyers. */
  async notifySavedSearchMatch(
    user: NotifiableUser,
    listingTitle: string,
    savedSearchName: string,
  ): Promise<void> {
    const subject = `New match for your saved search "${savedSearchName}"`;
    const body =
      `A new listing just went up matching your saved search "${savedSearchName}": "${listingTitle}". ` +
      `Check it out on Bhavano before anyone else does.`;

    await this.dispatch(user, subject, body);
  }

  /** Fired once, on a user's first-ever login (see AuthService.verifyOtp/loginWithGoogle) —
   * across whichever of email/phone the user has on file, since a phone-OTP signup has no
   * email and a Google signup has no phone. */
  async notifyWelcome(user: {
    name: string | null;
    email: string | null;
    phone: string | null;
  }): Promise<void> {
    const greeting = user.name ? `Hi ${user.name}` : 'Hi';
    const emailBody =
      `${greeting},\n\nWelcome to Bhavano! We're glad you're here.\n\n` +
      `Browse verified listings, post your own ad, and message buyers/sellers directly — all free.\n\n` +
      `— Team Bhavano`;
    const smsBody = `${greeting}, welcome to Bhavano! Browse verified listings or post your own ad — all free.`;

    await Promise.all([
      user.email
        ? this.emailProvider.send(user.email, 'Welcome to Bhavano!', emailBody)
        : Promise.resolve(),
      user.phone
        ? this.msg91.sendTransactionalSms(user.phone, smsBody)
        : Promise.resolve(),
      user.phone
        ? this.msg91.sendWhatsapp(user.phone, smsBody)
        : Promise.resolve(),
    ]);
  }

  private async dispatch(
    user: NotifiableUser,
    subject: string,
    body: string,
  ): Promise<void> {
    await Promise.all([
      user.email
        ? this.emailProvider.send(user.email, subject, body)
        : Promise.resolve(),
      user.phone
        ? this.msg91.sendTransactionalSms(user.phone, body)
        : Promise.resolve(),
    ]);
  }
}
