import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ListingDetailDto } from '@bhavano/types';
import { buildListingPath } from '@bhavano/types/listingPath';
import { WhatsappProvider } from './providers/whatsapp.provider';
import { EmailProvider } from './providers/email.provider';
import { Msg91Provider } from './providers/msg91.provider';
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
    private readonly msg91: Msg91Provider,
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

  /** Boost purchase confirmation — see PaymentsService.handleWebhook's `listing_boost` branch.
   * No WhatsApp template exists yet — see `notifyListingFlagged`'s comment; a phone-only owner
   * gets nothing until one is built. */
  async notifyListingBoostActivated(
    user: NotifiableUser,
    listingTitle: string,
    boostDays: number,
  ): Promise<'email' | 'whatsapp' | null> {
    const subject = `Boost is on for "${listingTitle}"`;
    const body =
      `Your listing "${listingTitle}" is boosted for the next ${boostDays} day${boostDays === 1 ? '' : 's'} — ` +
      `it'll get priority placement so more buyers see it first.`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body, bcc: 'support@bhavano.com' });
  }

  /** Boost + Instant Alerts bundle confirmation — see PaymentsService.handleWebhook's
   * `listing_boost` branch (the `boostIncludesInstantAlerts` case). One combined email rather
   * than firing `notifyListingBoostActivated` and `notifyInstantAlertsActivated` back to back,
   * since the buyer made one purchase, not two. No WhatsApp template exists yet — same gap as
   * the other purchase confirmations in this file. */
  async notifyBoostAndInstantAlertsActivated(
    user: NotifiableUser,
    listingTitle: string,
    boostDays: number,
  ): Promise<'email' | 'whatsapp' | null> {
    const subject = `Boost + Instant Alerts is on for "${listingTitle}"`;
    const body =
      `Your listing "${listingTitle}" is boosted for the next ${boostDays} day${boostDays === 1 ? '' : 's'} — ` +
      `it'll get priority placement so more buyers see it first. We'll also email you (or WhatsApp you, if ` +
      `that's what you gave us) the moment someone messages you about it, for as long as this ad is live.`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body, bcc: 'support@bhavano.com' });
  }

  /** Confirms an Instant Alerts purchase actually went through — see
   * PaymentsService.handleWebhook's `instant_alerts` branch. No WhatsApp template exists yet —
   * see `notifyListingFlagged`'s comment; a phone-only owner gets nothing until one is built. */
  async notifyInstantAlertsActivated(
    user: NotifiableUser,
    listingTitle: string,
  ): Promise<'email' | 'whatsapp' | null> {
    const subject = `Instant Alerts is on for "${listingTitle}"`;
    const body =
      `You're all set — we'll email you (or WhatsApp you, if that's what you gave us) the moment ` +
      `someone messages you about "${listingTitle}". No more checking back and forth.`;

    // BCC support so someone at support@ has visibility into every paid activation going out —
    // same reasoning as notifyWelcome's bcc, now extended to every purchase confirmation in this
    // file rather than just the welcome email.
    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body, bcc: 'support@bhavano.com' });
  }

  /** Bhavano Plus (buyer_premium) purchase confirmation — see PaymentsService.handleWebhook's
   * `buyer_premium` branch. No WhatsApp template exists yet — see `notifyListingFlagged`'s
   * comment. */
  async notifyBuyerPremiumActivated(user: NotifiableUser, endsAt: Date): Promise<'email' | 'whatsapp' | null> {
    const subject = 'Bhavano Plus is active';
    const body =
      `You're on Bhavano Plus until ${endsAt.toLocaleDateString('en-IN')} — early-access alerts on saved ` +
      `searches, a Verified Buyer badge on your messages, and priority in sellers' inboxes are all live now.`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body, bcc: 'support@bhavano.com' });
  }

  /** Seller slot pack purchase confirmation — see PaymentsService.handleWebhook's
   * `seller_slot_pack` branch. */
  async notifySellerSlotPackActivated(
    user: NotifiableUser,
    endsAt: Date,
    totalSlots: number,
  ): Promise<'email' | 'whatsapp' | null> {
    const subject = 'Seller slot pack is active';
    const body =
      `Your seller slot pack is active until ${endsAt.toLocaleDateString('en-IN')} — you can now run up to ` +
      `${totalSlots} active listings at once.`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body, bcc: 'support@bhavano.com' });
  }

  /** Agent/Broker Pro purchase confirmation — see PaymentsService.handleWebhook's `agent_pro`
   * branch. `slots` is the total this purchase grants (units × the per-unit slot count), not the
   * unit count itself, to match what the seller actually sees on `/premium`. */
  async notifyAgentProActivated(user: NotifiableUser, endsAt: Date, slots: number): Promise<'email' | 'whatsapp' | null> {
    const subject = 'Agent/Broker Pro is active';
    const body =
      `Agent/Broker Pro is active until ${endsAt.toLocaleDateString('en-IN')} — ${slots} active listing slots, ` +
      `your branded storefront, elevated video limits, and a monthly boost credit are all live now.`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body, bcc: 'support@bhavano.com' });
  }

  /** Contact-reveal credit pack purchase confirmation — see PaymentsService.handleWebhook's
   * `contact_reveal_credits` branch. */
  async notifyContactRevealCreditsActivated(
    user: NotifiableUser,
    creditsGranted: number,
    expiresAt: Date,
  ): Promise<'email' | 'whatsapp' | null> {
    const subject = `${creditsGranted} contact-reveal credits added`;
    const body =
      `${creditsGranted} contact-reveal credits have been added to your account, valid until ` +
      `${expiresAt.toLocaleDateString('en-IN')} — use them to view any listing's phone number and email.`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body, bcc: 'support@bhavano.com' });
  }

  /** Instant Alerts' actual per-message payoff — see MessagingService's `wasUnread` gate, which
   * only calls this on the message that flips the owner's unread count from zero to nonzero (one
   * alert per burst, not per message). `senderName` is already a role-label fallback
   * ("Buyer"/"Seller"/"Bhavano Admin") when the sender has no name set — never a raw phone/email,
   * matching the same leak-prevention rule already applied to push-notification titles. No
   * WhatsApp template exists yet — see `notifyListingFlagged`'s comment. */
  async notifyNewMessage(
    user: NotifiableUser,
    params: { senderName: string; listingTitle: string; conversationId: string },
  ): Promise<'email' | 'whatsapp' | null> {
    const site = this.config.get<string>('PUBLIC_SITE_URL') ?? 'https://www.bhavano.com';
    const link = `${site}/messages/${params.conversationId}`;
    const subject = `New message about "${params.listingTitle}"`;
    const body =
      `${params.senderName} sent you a message about "${params.listingTitle}" on Bhavano.\n\n` +
      `Reply here: ${link}`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body });
  }

  /** Bhavano Plus's early-access alerts — the proactive counterpart to a buyer having to keep
   * re-checking browse pages themselves. See SavedSearchesService.notifyMatchingBuyers.
   *
   * No WhatsApp template exists yet — see `notifyListingFlagged`'s comment. */
  /** Confirms a requirement captured from an empty search — see
   * docs/plans/property-requirements-demand-side.md.
   *
   * The message is deliberately honest about which of two things is happening. With an alert
   * (the seeker was inside their free quota, or has Plus) we can promise to tell them
   * automatically. Without one, we can only promise that a person will look — and saying so is
   * better than implying an alert that will never arrive. */
  async notifyRequirementCaptured(
    user: NotifiableUser,
    searchLabel: string,
    hasAlert: boolean,
  ): Promise<'email' | 'whatsapp' | null> {
    const subject = `We're looking for: ${searchLabel}`;
    const body = hasAlert
      ? `Thanks — we've noted that you're looking for ${searchLabel}. ` +
        `We'll message you as soon as something matching is posted, and our team will also check ` +
        `whether anything already listed is close enough to be worth a look.`
      : `Thanks — we've noted that you're looking for ${searchLabel}. ` +
        `Our team will check what's available and get back to you. ` +
        `You can also turn on instant alerts from your account so new matches reach you the moment they're posted.`;

    return this.dispatchEmailPreferWhatsapp(user, { subject, text: body });
  }

  /** Daily digest of unmet demand to whoever runs the site — see RequirementDigestJob.
   *
   * Exists because Phase 0's value depends entirely on a person reading the requirements queue,
   * and the seeker has by then been told in writing that "our team will get back to you". A
   * screen nobody opens turns that into a broken promise, so this pushes rather than waits to be
   * pulled. Email only (not the WhatsApp-preferring path the rest of this file uses): it's an
   * internal list of several items, which is an email, not a template message. */
  async notifyRequirementDigest(
    admin: NotifiableUser,
    lines: string[],
    openTotal: number,
  ): Promise<'email' | 'whatsapp' | null> {
    const subject = `${lines.length} new requirement${lines.length === 1 ? '' : 's'} — ${openTotal} open`;
    const body =
      `People searched for these and found nothing:\n\n${lines.map((line) => `• ${line}`).join('\n')}\n\n` +
      `${openTotal} requirement${openTotal === 1 ? ' is' : 's are'} open in total. ` +
      `Work them at https://admin.bhavano.com/requirements — each one is both a lead and a gap in inventory.`;

    return this.dispatchEmailPreferWhatsapp({ ...admin, phone: null }, { subject, text: body });
  }

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
    const welcomeTemplate = this.config.get<string>(
      'WHATSAPP_WELCOME_TEMPLATE',
    );
    const { subject, text, html } = this.buildWelcomeEmailContent(user.name);

    return this.dispatchEmailPreferWhatsapp(
      user,
      // BCC support so someone at support@ can see every welcome email actually going out —
      // requested for visibility into delivery, not because support needs to act on each one.
      { subject, text, html, bcc: 'support@bhavano.com' },
      // welcome_signup was submitted with positional {{1}}, not named — an array, not the
      // {name: ...} object listing_posted_v2 takes. The variable is the name alone, not a
      // "Hi <name>" greeting, since the approved template supplies its own wording around it.
      welcomeTemplate
        ? { template: welcomeTemplate, params: [user.name ?? 'there'] }
        : undefined,
    );
  }

  /** The welcome email's subject/text/html — factored out of `notifyWelcome` so
   * `sendWelcomeEmail` (the admin-triggered forced-channel resend) can build the exact same
   * content without going through `dispatchEmailPreferWhatsapp`'s email-else-WhatsApp choice. */
  private buildWelcomeEmailContent(
    name: string | null,
  ): { subject: string; text: string; html: string } {
    const site =
      this.config.get<string>('PUBLIC_SITE_URL') ?? 'https://www.bhavano.com';

    // Copy lives in apps/bff/notification-templates/email/welcome/, not here — see that folder's
    // README. `{{name}}` falls back to "there" rather than the old "Welcome to Bhavano"/plain
    // "Hi," special-casing for a nameless user: one substitution rule shared with
    // notifyListingPosted rather than each notification inventing its own fallback wording.
    const tpl = loadTemplate('email/welcome');
    const vars = { name: name ?? 'there' };
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

    return { subject: renderTemplate(tpl.subject, vars), text, html };
  }

  /** Forces the welcome email regardless of whether the user also has a phone — used by the
   * admin Users page's "Send welcome email" bulk action, where the admin has explicitly chosen
   * the channel rather than letting `dispatchEmailPreferWhatsapp` pick one. */
  async sendWelcomeEmail(user: {
    name: string | null;
    email: string;
  }): Promise<'email' | null> {
    const { subject, text, html } = this.buildWelcomeEmailContent(user.name);
    const sent = await this.emailProvider.send(user.email, subject, text, {
      html,
      bcc: 'support@bhavano.com',
    });
    return sent ? 'email' : null;
  }

  /** Forces the WhatsApp welcome via MSG91 — the real-time path for any phone-only first login
   * (see AuthService.welcomeIfFirstLogin), and also the admin Users page's "Send welcome
   * WhatsApp" bulk action. The one channel proven to actually deliver (see
   * docs/plans/whatsapp-welcome-mobile-signups.md). */
  async sendWelcomeWhatsapp(user: {
    name: string | null;
    phone: string;
  }): Promise<'whatsapp' | null> {
    const sent = await this.msg91.sendWhatsappTemplate(
      user.phone,
      user.name ?? 'there',
    );
    return sent ? 'whatsapp' : null;
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
    email: { subject: string; text: string; html?: string; bcc?: string },
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
        email.html || email.bcc ? { html: email.html, bcc: email.bcc } : undefined,
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
  ): Promise<{ channel: 'email' | 'whatsapp'; messageId?: string | null } | null> {
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
        { html, bcc: 'support@bhavano.com' },
      );
      return { channel: 'email' };
    }

    if (user.phone) {
      // Via MSG91's "listing_posted" template, not the Meta-direct WhatsappProvider used
      // elsewhere in this file — see Msg91Provider.sendAdPostedConfirmation. The template repeats
      // the listing title twice in its own wording (title/title2), so both map to the same
      // value; location is "area, city" to match how the rest of the app renders a listing's
      // location. The button's fixed prefix is baked into the approved template itself — only
      // the suffix after it is a per-send variable, so `path` (already leading with "/") has its
      // own leading slash stripped to avoid a doubled one.
      const result = await this.msg91.sendAdPostedConfirmation(
        user.phone,
        {
          name: vars.name,
          title: listing.title,
          title2: listing.title,
          location: `${listing.area}, ${listing.cityName}`,
        },
        path.replace(/^\//, ''),
      );
      return result.sent ? { channel: 'whatsapp', messageId: result.messageId } : null;
    }

    return null;
  }
}
