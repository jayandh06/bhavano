import Link from "next/link";
import type { ContactRevealSettingsDto, UserProfileDto } from "@bhavano/types";
import type { SubscriptionPlanSettings } from "@bhavano/types/subscriptionPricing";
import { PlanComparisonTable } from "@/components/home/PlanComparisonTable";
import { ListingSlotMeter } from "@/components/home/ListingSlotMeter";
import { SubscribeButton } from "@/components/home/SubscribeButton";
import { Icon } from "./Icon";

/**
 * The whole of `/premium`, for logged-in and logged-out visitors alike (`profile` is null for
 * the latter) — comparison tables first, then a card per plan with the real duration/price
 * picker, on one scrolling page.
 *
 * This replaced a "Compare plans" / "Subscribe & manage" tab switcher, and a separate
 * PremiumPlansPublic that rendered the table plus a login prompt. Two reasons the tabs went:
 *
 * - Tab state is client-side, so crawlers only ever saw the compare tab. Every plan's benefit
 *   copy — early-access alerts, the branded storefront, video limits — was invisible to search
 *   on a page whose whole job is ranking for plan/pricing queries. Without that `useState` this
 *   is a server component again, so all of it is in the initial HTML.
 * - Deciding and acting were on different tabs: you compared, picked a plan, then had to notice
 *   the tab, switch, and find that plan again. The comparison tables' own CTA row now links
 *   straight down to the matching card here (hence the ids below).
 *
 * A logged-out visitor sees the same cards and can click Subscribe — SubscribeButton checks the
 * session itself and resumes into checkout after login, rather than this view gating them out
 * ahead of time.
 */
export function PremiumPlansView({
  profile,
  contactRevealSettings,
  planPricing,
}: {
  profile: UserProfileDto | null;
  contactRevealSettings: ContactRevealSettingsDto;
  planPricing: SubscriptionPlanSettings;
}) {
  const premiumUntil = profile?.premiumUntil ? new Date(profile.premiumUntil) : null;
  const agentProUntil = profile?.agentProUntil ? new Date(profile.agentProUntil) : null;
  const sellerSlotPackUntil = profile?.sellerSlotPackUntil ? new Date(profile.sellerSlotPackUntil) : null;
  const isPremium = !!premiumUntil && premiumUntil.getTime() > Date.now();
  const isAgentPro = !!agentProUntil && agentProUntil.getTime() > Date.now();
  const isSellerPack = !!sellerSlotPackUntil && sellerSlotPackUntil.getTime() > Date.now();
  const proSlots = ((profile?.agentProUnits || 1)) * planPricing.proListingSlotsPerUnit;

  return (
    <div className="flex flex-col gap-8">
      <PlanComparisonTable
        profile={profile}
        contactRevealSettings={contactRevealSettings}
        planPricing={planPricing}
      />

      {/* Only means anything once there's an account to meter — a logged-out visitor has no
          slots in use. */}
      {profile && <ListingSlotMeter profile={profile} />}

      <div className="flex flex-col gap-6">
        <h2 className="font-lora text-lg font-semibold m-0">Pick a plan</h2>

        <section className="border border-border rounded-2xl p-6 bg-surface">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
            <div className="font-lora text-xl font-bold text-text">Free seller</div>
            <span className="text-[13px] font-bold text-green">₹0</span>
          </div>
          <p className="text-[13px] text-muted mb-3 m-0">
            {planPricing.freeListingSlots} active listings — included for every account.
          </p>
          <Link
            href="/post"
            className="inline-block text-[13px] font-bold text-green border-[1.5px] border-border rounded-[10px] px-4 py-2.5 bg-surface-alt"
          >
            Post a free ad →
          </Link>
        </section>

        {/* scroll-mt clears the sticky Header.tsx so #agent-pro etc. anchor-scrolls land with the
          * section's own title visible, not tucked under the header. Two values, not one: on
          * mobile the header collapses to a 52px bar on scroll (MobileHeaderCollapse.tsx), so the
          * default 80px is already generous — but that collapse is explicitly desktop-exempt
          * (`sm:hidden`), where the header stays fully expanded at its documented ~150px
          * (MobileHeaderCollapse.tsx:113's own comment) the whole time. */}
        <section id="bhavano-plus" className="border border-border rounded-2xl p-6 bg-surface scroll-mt-20 sm:scroll-mt-[160px]">
          <div className="font-lora text-xl font-bold text-text mb-1 flex items-center gap-2"><Icon name="featured" /> Bhavano Plus</div>
          <p className="text-[13px] text-muted mb-4 m-0">For buyers &amp; renters — get noticed, get answered faster.</p>
          <ul className="text-[13px] text-text-soft m-0 mb-4 pl-5 list-disc flex flex-col gap-1">
            <li>
              <strong>Early-access alerts</strong> — saved-search notifications when a matching listing posts
            </li>
            <li>A &ldquo;Verified Buyer&rdquo; badge on messages you send</li>
            <li>Priority visibility in sellers&apos; inboxes</li>
          </ul>
          {isPremium && premiumUntil ? (
            <div className="flex flex-col gap-2 items-start">
              <p className="text-[13px] font-bold text-green m-0">Active until {premiumUntil.toLocaleDateString()}</p>
              <Link href="/saved-searches" className="text-[13px] font-bold text-green">
                Manage your saved searches →
              </Link>
            </div>
          ) : (
            <SubscribeButton tier="buyerPremium" planPricing={planPricing} />
          )}
        </section>

        <section id="seller-slots" className="border border-border rounded-2xl p-6 bg-surface scroll-mt-20 sm:scroll-mt-[160px]">
          <div className="font-lora text-xl font-bold text-text mb-1 flex items-center gap-2"><Icon name="pack" /> Seller slot pack</div>
          <p className="text-[13px] text-muted mb-4 m-0">For individual sellers — more active ads at once.</p>
          <ul className="text-[13px] text-text-soft m-0 mb-4 pl-5 list-disc flex flex-col gap-1">
            <li>
              <strong>{planPricing.sellerSlotPackTotalSlots} active listings</strong> at once (
              {planPricing.freeListingSlots} free + {planPricing.sellerSlotPackTotalSlots - planPricing.freeListingSlots} extra)
            </li>
            <li>Slots free up when an ad expires or you remove it</li>
          </ul>
          {isSellerPack && sellerSlotPackUntil ? (
            <p className="text-[13px] font-bold text-green m-0">Active until {sellerSlotPackUntil.toLocaleDateString()}</p>
          ) : (
            <SubscribeButton tier="sellerSlotPack" planPricing={planPricing} />
          )}
        </section>

        <section id="agent-pro" className="border border-border rounded-2xl p-6 bg-surface scroll-mt-20 sm:scroll-mt-[160px]">
          <div className="font-lora text-xl font-bold text-text mb-1 flex items-center gap-2"><Icon name="building" /> Agent/Broker Pro</div>
          <p className="text-[13px] text-muted mb-4 m-0">For agents &amp; brokers — scale inventory and brand.</p>
          <ul className="text-[13px] text-text-soft m-0 mb-4 pl-5 list-disc flex flex-col gap-1">
            <li>
              <strong>{planPricing.proListingSlotsPerUnit} active listings</strong> per ₹{planPricing.agentProMonthlyPricePerUnit}/month
              (each extra ₹{planPricing.agentProMonthlyPricePerUnit} adds +{planPricing.proListingSlotsPerUnit})
            </li>
            <li>Public storefront with Bhavano Pro badge</li>
            <li>Elevated video limits when posting</li>
            <li>One 7-day boost credit per month</li>
          </ul>
          {isAgentPro && agentProUntil && profile ? (
            <div className="flex flex-col gap-2 items-start">
              <p className="text-[13px] font-bold text-green m-0">
                Active until {agentProUntil.toLocaleDateString()} · {proSlots} listing slots
              </p>
              <Link href={`/agent/${profile.id}`} className="text-[13px] font-bold text-green">
                View your storefront →
              </Link>
            </div>
          ) : (
            <SubscribeButton tier="agentPro" planPricing={planPricing} />
          )}
        </section>

        <section id="contact-reveal-credits" className="border border-border rounded-2xl p-6 bg-surface scroll-mt-20 sm:scroll-mt-[160px]">
          <div className="font-lora text-xl font-bold text-text mb-1 flex items-center gap-2">
            <Icon name="phone" /> Contact reveal credits
          </div>
          <p className="text-[13px] text-muted mb-4 m-0">
            Not a subscription — pay-as-you-go, for viewing any listing&apos;s phone number and email.
          </p>
          <ul className="text-[13px] text-text-soft m-0 mb-4 pl-5 list-disc flex flex-col gap-1">
            <li>
              <strong>{contactRevealSettings.freeRevealsPerUser} free reveals</strong> on every account, no purchase needed
            </li>
            <li>
              Then <strong>{contactRevealSettings.creditPackSize} reveals for ₹{contactRevealSettings.creditPackPriceRupees}</strong> —
              a credit unlocks a listing&apos;s contact info for good, not just for one visit
            </li>
            <li>Credits last {contactRevealSettings.creditExpiryMonths} month{contactRevealSettings.creditExpiryMonths === 1 ? "" : "s"} from purchase</li>
          </ul>
          <p className="text-[13px] text-muted m-0">
            No purchase button here — buy credits from any listing&apos;s &ldquo;View Contact&rdquo; button when you need them.
          </p>
        </section>
      </div>
    </div>
  );
}
