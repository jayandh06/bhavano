import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ListingDetailDto } from '@bhavano/types';
import { Msg91Provider } from './providers/msg91.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';
import { EmailProvider } from './providers/email.provider';
import { renderEmail } from './emailLayout';

interface NotifiableUser {
  email: string | null;
  phone: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly emailProvider: EmailProvider,
    private readonly msg91: Msg91Provider,
    private readonly whatsapp: WhatsappProvider,
    private readonly config: ConfigService,
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
    const site =
      this.config.get<string>('PUBLIC_SITE_URL') ?? 'https://www.bhavano.com';
    const paragraphs = [
      `${greeting}, and welcome to Bhavano.`,
      'You can post ads free, browse listings across India, and message buyers and sellers directly — no brokerage, no middlemen.',
      'Posting takes about two minutes, and your ad goes live straight away.',
    ];
    // The text/plain part is not an afterthought: spam filters read it, and some clients show it
    // instead of the HTML. It carries the same call to action as a bare URL, since a link with
    // nothing to hang an href on is useless there.
    const emailBody = `${paragraphs.join('\n\n')}\n\nPost your first ad: ${site}/post\n\n— Team Bhavano`;
    const smsBody = `${greeting}, welcome to Bhavano! Browse verified listings or post your own ad — all free.`;
    const welcomeTemplate = this.config.get<string>(
      'WHATSAPP_WELCOME_TEMPLATE',
    );

    await Promise.all([
      user.email
        ? this.emailProvider.send(
            user.email,
            'Welcome to Bhavano!',
            emailBody,
            {
              html: renderEmail({
                heading: 'Welcome to Bhavano',
                preheader:
                  'Post ads free, browse listings across India, and message buyers and sellers directly.',
                paragraphs,
                button: { label: 'Post your first ad', url: `${site}/post` },
              }),
            },
          )
        : Promise.resolve(),
      user.phone
        ? this.msg91.sendTransactionalSms(user.phone, smsBody)
        : Promise.resolve(),
      // Meta's Cloud API directly (see WhatsappProvider). The variable is the name alone, not
      // the "Hi <name>" greeting used above: the approved template supplies its own wording
      // around it, so passing a greeting would render "Welcome to Bhavano, Hi Ravi!".
      user.phone && welcomeTemplate
        ? this.whatsapp.sendTemplate(user.phone, welcomeTemplate, [
            user.name ?? 'there',
          ])
        : Promise.resolve(),
    ]);
  }

  /** Listing expiry reminder — email when the user has one; SMS only when email is missing. */
  async notifyListingExpiryReminder(
    user: NotifiableUser & { name?: string | null },
    listingTitle: string,
    expiresAt: Date,
    daysLeft: number,
  ): Promise<'email' | 'sms' | null> {
    const siteUrl =
      this.config.get<string>('PUBLIC_SITE_URL') ?? 'https://bhavano.com';
    const expiryDate = expiresAt.toLocaleDateString('en-IN', {
      dateStyle: 'medium',
    });
    const subject = `Your listing "${listingTitle}" expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
    const body =
      `${user.name ? `Hi ${user.name}` : 'Hi'},\n\n` +
      `Your Bhavano listing "${listingTitle}" will expire on ${expiryDate} ` +
      `(${daysLeft} day${daysLeft === 1 ? '' : 's'} from now). After that it will stop appearing in search and your listing slot will free up.\n\n` +
      `Manage your ads: ${siteUrl}/my-listings\n\n` +
      `— Team Bhavano`;
    const smsBody = `Bhavano: "${listingTitle}" expires in ${daysLeft}d (${expiryDate}). Manage: ${siteUrl}/my-listings`;

    return this.dispatchEmailPreferSms(user, subject, body, smsBody);
  }

  /** Email if available; otherwise SMS (no duplicate SMS when email exists). */
  private async dispatchEmailPreferSms(
    user: NotifiableUser,
    subject: string,
    emailBody: string,
    smsBody: string,
  ): Promise<'email' | 'sms' | null> {
    if (user.email) {
      await this.emailProvider.send(user.email, subject, emailBody);
      return 'email';
    }
    if (user.phone) {
      await this.msg91.sendTransactionalSms(user.phone, smsBody);
      return 'sms';
    }
    return null;
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
