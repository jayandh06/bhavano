import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ListingDetailDto } from '@bhavano/types';
import { buildListingPath } from '@bhavano/types/listingPath';
import { Msg91Provider } from './providers/msg91.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';
import { EmailProvider } from './providers/email.provider';
import { renderEmail } from './emailLayout';
import { loadTemplate, renderTemplate } from './templateLoader';

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
    const smsBody = `${greeting}, welcome to Bhavano! Browse verified listings or post your own ad — all free.`;
    const welcomeTemplate = this.config.get<string>(
      'WHATSAPP_WELCOME_TEMPLATE',
    );

    // Copy lives in apps/bff/notification-templates/email/welcome/, not here — see that folder's
    // README. `{{name}}` falls back to "there" rather than the old "Welcome to Bhavano"/plain
    // "Hi," special-casing for a nameless user: one substitution rule shared with
    // notifyListingPosted rather than each notification inventing its own fallback wording.
    const tpl = loadTemplate('email/welcome');
    const vars = { name: user.name ?? 'there' };
    const paragraphs = tpl.paragraphs.map((p) => renderTemplate(p, vars));
    const buttonLabel = tpl.buttonLabel
      ? renderTemplate(tpl.buttonLabel, vars)
      : undefined;
    const html = renderEmail({
      heading: renderTemplate(tpl.heading, vars),
      preheader: renderTemplate(tpl.preheader, vars),
      paragraphs,
      button: buttonLabel
        ? { label: buttonLabel, url: `${site}/post` }
        : undefined,
    });
    // The text/plain part is not an afterthought: spam filters read it, and some clients show it
    // instead of the HTML. It carries the same call to action as a bare URL, since a link with
    // nothing to hang an href on is useless there.
    const emailBody =
      paragraphs.join('\n\n') +
      (buttonLabel ? `\n\n${buttonLabel}: ${site}/post` : '');

    await Promise.all([
      user.email
        ? this.emailProvider.send(
            user.email,
            renderTemplate(tpl.subject, vars),
            emailBody,
            { html },
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

  /**
   * Tells someone their ad went live — the one thing `ListingsService.create` never announced.
   * See docs/plans/post-ad-acknowledgement.md for why this exists and why the channel rule below
   * is deliberately different from every other notification in this file.
   *
   * Email if they have one, else WhatsApp — never both, and no SMS fallback. That last part is a
   * real trade, not an oversight: a phone-only user whose WhatsApp send fails (unconfigured
   * sender, unapproved template, a transient Graph API error) gets told nothing at all. Accepted
   * because the ad itself is unaffected either way — it is already live under `/my-listings` —
   * and because SMS cannot carry this message: DLT registration would need its own approved
   * template for free-form text, which is a separate, larger piece of work than this feature.
   *
   * The email body's actual words live in `apps/bff/notification-templates/listing-posted/`, not
   * here — see that folder's README for why, and for how to change the wording without a code
   * change. This method is the plumbing: which fields go in, which channel gets used, never the
   * copy itself.
   */
  async notifyListingPosted(
    user: NotifiableUser & { name?: string | null },
    listing: Pick<
      ListingDetailDto,
      | 'id'
      | 'slug'
      | 'category'
      | 'transactionType'
      | 'cityName'
      | 'area'
      | 'title'
    >,
  ): Promise<'email' | 'whatsapp' | null> {
    const site =
      this.config.get<string>('PUBLIC_SITE_URL') ?? 'https://www.bhavano.com';
    const path = buildListingPath(listing);
    const link = `${site}${path}`;
    const vars = { name: user.name ?? 'there', title: listing.title };

    if (user.email) {
      const tpl = loadTemplate('email/listing-posted');
      const paragraphs = tpl.paragraphs.map((p) => renderTemplate(p, vars));
      const buttonLabel = tpl.buttonLabel
        ? renderTemplate(tpl.buttonLabel, vars)
        : undefined;
      const html = renderEmail({
        heading: renderTemplate(tpl.heading, vars),
        preheader: renderTemplate(tpl.preheader, vars),
        paragraphs,
        button: buttonLabel ? { label: buttonLabel, url: link } : undefined,
      });
      // The plain-text part mirrors the HTML rather than reusing renderEmail's own text — that
      // function only ever produces markup, matching notifyWelcome's separate emailBody/html
      // pair. A link with nothing to hang an href on needs to be a bare URL here instead of a
      // button label, or it would be unreadable in a text-only client.
      const text =
        `${paragraphs.join('\n\n')}\n\n` +
        (buttonLabel ? `${buttonLabel}: ${link}` : link);
      await this.emailProvider.send(
        user.email,
        renderTemplate(tpl.subject, vars),
        text,
        { html },
      );
      return 'email';
    }

    if (user.phone) {
      const template = this.config.get<string>(
        'WHATSAPP_LISTING_POSTED_TEMPLATE',
      );
      if (!template) return null;
      // The button's fixed prefix is baked into the approved template itself (see
      // whatsapp_create_listing_posted_template.py's BUTTON_URL_BASE) — only the suffix after it
      // is a per-send variable, so `path` (already leading with "/") has its own leading slash
      // stripped to avoid a doubled one.
      const sent = await this.whatsapp.sendTemplate(
        user.phone,
        template,
        vars,
        path.replace(/^\//, ''),
      );
      return sent ? 'whatsapp' : null;
    }

    return null;
  }
}
