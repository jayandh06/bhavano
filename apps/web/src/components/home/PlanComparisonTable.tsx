import Link from "next/link";
import type { UserProfileDto } from "@bhavano/types";
import {
  FREE_LISTING_SLOTS,
  PRO_LISTING_SLOTS_PER_UNIT,
  SELLER_SLOT_PACK_TOTAL,
} from "@bhavano/types/listingSlots";

type Cell = string | { type: "yes" } | { type: "no" } | { type: "dash" };

function CellContent({ value }: { value: Cell }) {
  if (typeof value === "string") {
    return <span className="text-[13px] text-text">{value}</span>;
  }
  if (value.type === "yes") {
    return <span className="text-green font-bold text-[13px]" aria-label="Included">✓</span>;
  }
  if (value.type === "no") {
    return <span className="text-muted text-[13px]" aria-label="Not included">—</span>;
  }
  return <span className="text-muted text-[13px]">—</span>;
}

const SELLER_ROWS: { label: string; free: Cell; pack: Cell; pro: Cell }[] = [
  { label: "Price", free: "₹0", pack: "₹149 / month", pro: "₹499 / month" },
  {
    label: "Active listings at once",
    free: String(FREE_LISTING_SLOTS),
    pack: String(SELLER_SLOT_PACK_TOTAL),
    pro: `${PRO_LISTING_SLOTS_PER_UNIT} (+20 per extra ₹499)`,
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

const BUYER_ROWS: { label: string; plus: Cell }[] = [
  { label: "Price", plus: "₹99 / mo · ₹549 / 6 mo · ₹899 / yr" },
  { label: "Early-access saved-search alerts", plus: { type: "yes" } },
  { label: "Verified Buyer badge on messages", plus: { type: "yes" } },
  { label: "Priority in sellers' inboxes", plus: { type: "yes" } },
  { label: "Extra listing slots for selling", plus: { type: "no" } },
  { label: "Best for", plus: "Buyers & renters" },
];

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

export function PlanComparisonTable({ profile }: { profile: UserProfileDto | null }) {
  const sellerPlan = currentSellerPlan(profile);
  const isBuyerPlus =
    profile?.premiumUntil && new Date(profile.premiumUntil).getTime() > Date.now();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-lora text-lg font-semibold m-0 mb-1">Selling — compare plans</h2>
        <p className="text-[13px] text-muted m-0 mb-4">
          Active listings use a slot until the ad expires (~30 days) or you remove it. Boosts are separate — buy
          from My listings anytime.
        </p>
        <div className="overflow-x-auto border border-border rounded-2xl bg-surface">
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
                <th className={headerClass(sellerPlan === "pack")} id="seller-slots">
                  Seller pack
                  {sellerPlan === "pack" && (
                    <span className="block text-[11px] font-normal text-green mt-0.5">Your plan</span>
                  )}
                </th>
                <th className={headerClass(sellerPlan === "pro")} id="agent-pro">
                  Agent Pro
                  {sellerPlan === "pro" && (
                    <span className="block text-[11px] font-normal text-green mt-0.5">Your plan</span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {SELLER_ROWS.map((row) => (
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
          </table>
        </div>
        {sellerPlan === "free" && (
          <p className="text-[13px] text-muted mt-3 m-0">
            On the free plan now?{" "}
            <Link href="/post" className="text-green font-bold">
              Post a free ad →
            </Link>
          </p>
        )}
      </div>

      <div>
        <h2 className="font-lora text-lg font-semibold m-0 mb-1">Buying — Bhavano Plus</h2>
        <p className="text-[13px] text-muted m-0 mb-4">For searching and messaging sellers — not for posting inventory.</p>
        <div className="overflow-x-auto border border-border rounded-2xl bg-surface">
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
              {BUYER_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="p-3 text-[12px] text-muted align-top">{row.label}</td>
                  <td className="p-3 align-top">
                    <CellContent value={row.plus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
