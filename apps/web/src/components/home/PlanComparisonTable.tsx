import Link from "next/link";
import type { ReactNode } from "react";
import { HorizontalScroller } from "./HorizontalScroller";
import type { ContactRevealSettingsDto, UserProfileDto } from "@bhavano/types";
import type { SubscriptionPlanSettings } from "@bhavano/types/subscriptionPricing";
import { Icon } from "./Icon";

type Cell = string | { type: "yes" } | { type: "no" } | { type: "dash" };

function CellContent({ value }: { value: Cell }) {
  if (typeof value === "string") {
    return <span className="text-[13px] text-text">{value}</span>;
  }
  if (value.type === "yes") {
    return <Icon name="check" className="text-green" label="Included" />;
  }
  if (value.type === "no") {
    return <span className="text-muted text-[13px]" aria-label="Not included">—</span>;
  }
  return <span className="text-muted text-[13px]">—</span>;
}

/** Built from live settings (not literal copy) so this table can never drift from what
 * SubscribeButton actually charges — see docs/plans/admin-manage-plans-pricing.md. */
function sellerRows(settings: SubscriptionPlanSettings): { label: string; free: Cell; pack: Cell; pro: Cell }[] {
  return [
    {
      label: "Price",
      free: "₹0",
      pack: `₹${settings.sellerSlotPackMonthlyPrice} / month`,
      pro: `₹${settings.agentProMonthlyPricePerUnit} / month`,
    },
    {
      label: "Active listings at once",
      free: String(settings.freeListingSlots),
      pack: String(settings.sellerSlotPackTotalSlots),
      pro: `${settings.proListingSlotsPerUnit} (+${settings.proListingSlotsPerUnit} per extra ₹${settings.agentProMonthlyPricePerUnit})`,
    },
    {
      label: "Slots free when ads expire or you remove them",
      free: { type: "yes" },
      pack: { type: "yes" },
      pro: { type: "yes" },
    },
    { label: "Public storefront page", free: "Basic", pack: "Basic", pro: "Branded + Pro badge" },
    { label: "Elevated video (3 × 120s)", free: { type: "no" }, pack: { type: "no" }, pro: { type: "yes" } },
    { label: "Monthly 7-day boost credit", free: { type: "no" }, pack: { type: "no" }, pro: { type: "yes" } },
    {
      label: "Pay-per-listing boost (Featured)",
      free: "Optional",
      pack: "Optional",
      pro: "Optional (+ credit)",
    },
    {
      label: "Best for",
      free: "Casual sellers",
      pack: "6–10 live ads",
      pro: "Agents & brokers",
    },
  ];
}

function buyerRows(settings: SubscriptionPlanSettings): { label: string; plus: Cell }[] {
  return [
    {
      label: "Price",
      plus: `₹${settings.buyerPremiumPrice1Month} / mo · ₹${settings.buyerPremiumPrice6Months} / 6 mo · ₹${settings.buyerPremiumPrice12Months} / yr`,
    },
    { label: "Early-access saved-search alerts", plus: { type: "yes" } },
    { label: "Verified Buyer badge on messages", plus: { type: "yes" } },
    { label: "Priority in sellers' inboxes", plus: { type: "yes" } },
    { label: "Extra listing slots for selling", plus: { type: "no" } },
    { label: "Best for", plus: "Buyers & renters" },
  ];
}

function currentSellerPlan(profile: UserProfileDto | null): "free" | "pack" | "pro" | null {
  if (!profile) return null;
  const now = Date.now();
  if (profile.agentProUntil && new Date(profile.agentProUntil).getTime() > now) return "pro";
  if (profile.sellerSlotPackUntil && new Date(profile.sellerSlotPackUntil).getTime() > now) return "pack";
  return "free";
}

function headerClass(isCurrent: boolean): string {
  return `text-left p-3 font-bold text-[13px] ${isCurrent ? "bg-green/10 text-green" : "text-text"}`;
}

/** Jumps to that plan's card further down the same page, where the real duration/price picker
 * lives — rather than a second copy of SubscribeButton squeezed into a table cell. Deciding and
 * acting used to be on two different tabs; this is what closes that gap. */
function ChooseLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-block text-[12px] font-bold text-green border-[1.5px] border-green rounded-lg px-3 py-1.5 whitespace-nowrap"
    >
      {label}
    </Link>
  );
}

/** Reads "Your plan" rather than a CTA for whichever tier the viewer is already on — offering to
 * buy something they currently hold is the one thing this row must never do. */
function CtaCell({ isCurrent, children }: { isCurrent: boolean; children: ReactNode }) {
  return (
    <td className={`p-3 align-top ${isCurrent ? "bg-green/10" : ""}`}>
      {isCurrent ? <span className="text-[12px] font-bold text-green">Your plan</span> : children}
    </td>
  );
}

export function PlanComparisonTable({
  profile,
  contactRevealSettings,
  planPricing,
}: {
  profile: UserProfileDto | null;
  contactRevealSettings: ContactRevealSettingsDto;
  planPricing: SubscriptionPlanSettings;
}) {
  const sellerPlan = currentSellerPlan(profile);
  const isBuyerPlus =
    profile?.premiumUntil && new Date(profile.premiumUntil).getTime() > Date.now();
  const sellerRowsData = sellerRows(planPricing);
  const buyerRowsData = buyerRows(planPricing);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-lora text-lg font-semibold m-0 mb-1">Selling — compare plans</h2>
        <p className="text-[13px] text-muted m-0 mb-4">
          Active listings use a slot until the ad expires (~30 days) or you remove it. Boosts are separate — buy
          from My listings anytime.
        </p>
        <HorizontalScroller ariaLabel="plan comparison" contentClassName="border border-border rounded-2xl bg-surface overflow-hidden">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 text-[12px] font-bold text-muted w-[28%]">Feature</th>
                <th className={headerClass(sellerPlan === "free")}>
                  Free
                  {sellerPlan === "free" && (
                    <span className="block text-[11px] font-normal text-green mt-0.5">Your plan</span>
                  )}
                </th>
                {/* No id="seller-slots"/id="agent-pro" here — those anchors belong to the plan
                    cards below (the ones with an actual subscribe button), which is where
                    /premium#agent-pro links from ListingSlotCapPrompt should land. Both used to
                    carry the same ids and only ever rendered one at a time, behind tabs; on one
                    page that would be a duplicate id. */}
                <th className={headerClass(sellerPlan === "pack")}>
                  Seller pack
                  {sellerPlan === "pack" && (
                    <span className="block text-[11px] font-normal text-green mt-0.5">Your plan</span>
                  )}
                </th>
                <th className={headerClass(sellerPlan === "pro")}>
                  Agent Pro
                  {sellerPlan === "pro" && (
                    <span className="block text-[11px] font-normal text-green mt-0.5">Your plan</span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {sellerRowsData.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="p-3 text-[12px] text-muted align-top">{row.label}</td>
                  <td className="p-3 align-top">
                    <CellContent value={row.free} />
                  </td>
                  <td className="p-3 align-top">
                    <CellContent value={row.pack} />
                  </td>
                  <td className="p-3 align-top">
                    <CellContent value={row.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-alt">
                <td className="p-3" />
                <CtaCell isCurrent={sellerPlan === "free"}>
                  <ChooseLink href="/post" label="Post a free ad" />
                </CtaCell>
                <CtaCell isCurrent={sellerPlan === "pack"}>
                  <ChooseLink href="#seller-slots" label="Choose Seller pack" />
                </CtaCell>
                <CtaCell isCurrent={sellerPlan === "pro"}>
                  <ChooseLink href="#agent-pro" label="Choose Agent Pro" />
                </CtaCell>
              </tr>
            </tfoot>
          </table>
        </HorizontalScroller>
      </div>

      <div>
        <h2 className="font-lora text-lg font-semibold m-0 mb-1">Buying — Bhavano Plus</h2>
        <p className="text-[13px] text-muted m-0 mb-4">For searching and messaging sellers — not for posting inventory.</p>
        <HorizontalScroller ariaLabel="plan comparison" contentClassName="border border-border rounded-2xl bg-surface overflow-hidden">
          <table className="w-full min-w-[320px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 text-[12px] font-bold text-muted text-left w-[40%]">Feature</th>
                <th className={headerClass(!!isBuyerPlus)}>
                  Bhavano Plus
                  {isBuyerPlus && <span className="block text-[11px] font-normal text-green mt-0.5">Your plan</span>}
                </th>
              </tr>
            </thead>
            <tbody>
              {buyerRowsData.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="p-3 text-[12px] text-muted align-top">{row.label}</td>
                  <td className="p-3 align-top">
                    <CellContent value={row.plus} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-alt">
                <td className="p-3" />
                <CtaCell isCurrent={!!isBuyerPlus}>
                  <ChooseLink href="#bhavano-plus" label="Choose Bhavano Plus" />
                </CtaCell>
              </tr>
            </tfoot>
          </table>
        </HorizontalScroller>
      </div>

      <div>
        <h2 className="font-lora text-lg font-semibold m-0 mb-1">Viewing contact details</h2>
        <p className="text-[13px] text-muted m-0 mb-4">
          Not a subscription — pay-as-you-go, for any buyer or seller. Every account starts with{" "}
          {contactRevealSettings.freeRevealsPerUser} free contact reveals; buy a credit pack from any listing&apos;s
          &ldquo;View Contact&rdquo; button once those run out.
        </p>
        <HorizontalScroller ariaLabel="contact reveal credits" contentClassName="border border-border rounded-2xl bg-surface overflow-hidden">
          <table className="w-full min-w-[320px] border-collapse">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 text-[12px] text-muted align-top w-[40%]">Free reveals per account</td>
                <td className="p-3 align-top text-[13px] text-text">{contactRevealSettings.freeRevealsPerUser}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 text-[12px] text-muted align-top">Credit pack</td>
                <td className="p-3 align-top text-[13px] text-text">
                  {contactRevealSettings.creditPackSize} reveals for ₹{contactRevealSettings.creditPackPriceRupees}
                </td>
              </tr>
              <tr className="border-b border-border last:border-0">
                <td className="p-3 text-[12px] text-muted align-top">Credit validity</td>
                <td className="p-3 align-top text-[13px] text-text">
                  {contactRevealSettings.creditExpiryMonths} month{contactRevealSettings.creditExpiryMonths === 1 ? "" : "s"} from purchase
                </td>
              </tr>
            </tbody>
          </table>
        </HorizontalScroller>
      </div>
    </div>
  );
}
