import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ListingDetailDto } from '@bhavano/types';
import { buildListingPath } from '@bhavano/types/listingPath';
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
    private readonly whatsapp: WhatsappProvider,
    private readonly config: ConfigService,
  ) {}

  /** No WhatsApp template exists yet for a moderation notice — see `dispatchEmailPreferWhatsapp`'s
   * own comment on what an absent `whatsapp` argument means. A phone-only owner gets nothing
   * until one is built and approved. */
  async notifyListingFlagged(
    user: NotifiableUser,
    listing: ListingDetailDto,
    message: string,
  ): Promise<'email' | 'whatsapp' | null> {
    const subject = `Action needed: your listing "${listing.title}" has been taken offline`;
    const body =
      `Hi, one of your listings ("${listing.title}") has been taken offline by a Bhavano moderator:\n\n` +
      `"${message}"\n\n` +
      `Please review and update your listing, then it will be reviewed again. ` +
      `You can reply to the moderator directly from the Messages section of your account.`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body });
  }

  /** See `notifyListingFlagged`'s comment on the missing WhatsApp template. */
  async notifyListingApproved(
    user: NotifiableUser,
    listing: ListingDetailDto,
  ): Promise<'email' | 'whatsapp' | null> {
    const subject = `Your listing "${listing.title}" is live again`;
    const body = `Good news — your listing "${listing.title}" has been reviewed and is live again on Bhavano.`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body });
  }

  /** A boost perk, not a universal notification — see ListingsService.toggleFavourite, which
   * only fires this while the listing is currently boosted. Unboosted listings can rack up many
   * casual likes with no real intent behind most of them; boosted ads are a much smaller, more
   * engaged set where "someone just liked your ad" is a meaningful, non-spammy signal.
   *
   * No WhatsApp template exists yet — see `notifyListingFlagged`'s comment. */
  async notifyListingLiked(
    user: NotifiableUser,
    listingTitle: string,
    likerName: string,
  ): Promise<'email' | 'whatsapp' | null> {
    const subject = `${likerName} liked your boosted ad`;
    const body = `${likerName} just added your listing "${listingTitle}" to their favourites on Bhavano.`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body });
  }

  /** Bhavano Plus's early-access alerts — the proactive counterpart to a buyer having to keep
   * re-checking browse pages themselves. See SavedSearchesService.notifyMatchingBuyers.
   *
   * No WhatsApp template exists yet — see `notifyListingFlagged`'s comment. */
  async notifySavedSearchMatch(
    user: NotifiableUser,
    listingTitle: string,
    savedSearchName: string,
  ): Promise<'email' | 'whatsapp' | null> {
    const subject = `New match for your saved search "${savedSearchName}"`;
    const body =
      `A new listing just went up matching your saved search "${savedSearchName}": "${listingTitle}". ` +
      `Check it out on Bhavano before anyone else does.`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body });
  }

  /** Fired once, on a user's first-ever login (see AuthService.verifyOtp/loginWithGoogle) —
   * across whichever of email/phone the user has on file, since a phone-OTP signup has no
   * email and a Google signup has no phone. Used to fire email + SMS + WhatsApp simultaneously
   * for anyone with all three on file; now email else WhatsApp like everything else in this file
   * (see `dispatchEmailPreferWhatsapp`). */
  async notifyWelcome(user: {
    name: string | null;
    email: string | null;
    phone: string | null;
  }): Promise<'email' | 'whatsapp' | null> {
    const site =
      this.config.get<string>('PUBLIC_SITE_URL') ?? 'https://www.bhavano.com';
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
    const text =
      paragraphs.join('\n\n') +
      (buttonLabel ? `\n\n${buttonLabel}: ${site}/post` : '');

    return this.dispatchEmailPreferWhatsapp(
      user,
      { subject: renderTemplate(tpl.subject, vars), text, html },
      // welcome_signup was submitted with positional {{1}}, not named — an array, not the
      // {name: ...} object listing_posted_v2 takes. The variable is the name alone, not a
      // "Hi <name>" greeting, since the approved template supplies its own wording around it.
      welcomeTemplate
        ? { template: welcomeTemplate, params: [user.name ?? 'there'] }
        : undefined,
    );
  }

  /** Listing expiry reminder — email if the user has one, else WhatsApp once a template exists
   * for this (none does yet — see `notifyListingFlagged`'s comment on what that means). Fired by
   * `ListingExpiryReminderJob`, which already logs to `ListingNotificationLog` itself on a
   * successful send — that part predates this refactor and is untouched. */
  async notifyListingExpiryReminder(
    user: NotifiableUser & { name?: string | null },
    listingTitle: string,
    expiresAt: Date,
    daysLeft: number,
  ): Promise<'email' | 'whatsapp' | null> {
    const site =
      this.config.get<string>('PUBLIC_SITE_URL') ?? 'https://www.bhavano.com';
    const expiryDate = expiresAt.toLocaleDateString('en-IN', {
      dateStyle: 'medium',
    });
    // Pluralised here, once, rather than inside the template — {{}} substitution is plain string
    // replacement with no conditional logic, so "1 day" vs "7 days" has to arrive as one already-
    // correct value.
    const daysLeftText = `${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

    const tpl = loadTemplate('email/listing-expiry-reminder');
    const vars = {
      name: user.name ?? 'there',
      title: listingTitle,
      expiryDate,
      daysLeft: daysLeftText,
    };
    const paragraphs = tpl.paragraphs.map((p) => renderTemplate(p, vars));
    const buttonLabel = tpl.buttonLabel
      ? renderTemplate(tpl.buttonLabel, vars)
      : undefined;
    const link = `${site}/my-listings`;
    const html = renderEmail({
      heading: renderTemplate(tpl.heading, vars),
      preheader: renderTemplate(tpl.preheader, vars),
      paragraphs,
      button: buttonLabel ? { label: buttonLabel, url: link } : undefined,
    });
    const text =
      `${paragraphs.join('\n\n')}\n\n` +
      (buttonLabel ? `${buttonLabel}: ${link}` : link);

    return this.dispatchEmailPreferWhatsapp(user, {
      subject: renderTemplate(tpl.subject, vars),
      text,
      html,
    });
  }

  /**
   * The one channel rule every notification in this file now shares: email if the user has one,
   * else WhatsApp, never both, never SMS. See
   * docs/plans/notification-delivery-tracking-and-engagement-alerts.md for why — short version,
   * SMS is reserved for `AuthService.sendOtp` alone from here on, and this replaces both
   * `dispatch` (email + SMS together) and `dispatchEmailPreferSms` (email else SMS), which this
   * file no longer has any use for.
   *
   * `whatsapp` is optional, and its absence is not an oversight to fix later per call site — it
   * means no approved WhatsApp template exists yet for that notification. Every method below that
   * omits it says so in its own comment. A phone-only user gets nothing from those until one is
   * built (mirroring `notifyListingPosted`'s already-accepted trade for the same reason), which is
   * a real, known gap this refactor introduces for four notifications that used to reach SMS.
   *
   * Reports which channel actually delivered rather than which was merely attempted — the caller
   * uses this to write a `ListingNotificationLog`/`UserNotificationLog` row, so an unattempted or
   * failed send must not be reported as a success.
   */
  private async dispatchEmailPreferWhatsapp(
    user: NotifiableUser,
    email: { subject: string; text: string; html?: string },
    whatsapp?: {
      template: string;
      params: string[] | Record<string, string>;
      buttonUrlSuffix?: string;
    },
  ): Promise<'email' | 'whatsapp' | null> {
    if (user.email) {
      const sent = await this.emailProvider.send(
        user.email,
        email.subject,
        email.text,
        email.html ? { html: email.html } : undefined,
      );
      return sent ? 'email' : null;
    }
    if (user.phone && whatsapp) {
      const sent = await this.whatsapp.sendTemplate(
        user.phone,
        whatsapp.template,
        whatsapp.params,
        whatsapp.buttonUrlSuffix,
      );
      return sent ? 'whatsapp' : null;
    }
    return null;
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
