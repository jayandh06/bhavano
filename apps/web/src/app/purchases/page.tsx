import Link from "next/link";
import { auth } from "@/auth";
import { BffAuthError, fetchPaymentHistory } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { isAccessTokenValid } from "@/lib/session";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";
import { HorizontalScroller } from "@/components/home/HorizontalScroller";
import type { PaymentHistoryItemDto, PaymentPurpose, PaymentStatus } from "@bhavano/types";

const PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  listing_boost: "Listing boost",
  buyer_premium: "Bhavano Plus",
  agent_pro: "Agent/Broker Pro",
  seller_slot_pack: "Seller slot pack",
  contact_reveal_credits: "Contact reveal credits",
};

const STATUS_STYLE: Record<PaymentStatus, string> = {
  paid: "text-green",
  created: "text-muted",
  failed: "text-[#b3413a]",
  refunded: "text-muted",
};

// No link to the listing here — PaymentHistoryItemDto only carries listingId/listingTitle, not
// the slug/category/transactionType/cityName/area a canonical listing URL needs (see
// packages/types/src/listingPath.ts's buildListingPath), and there's no generic id-based
// redirect route in this app to fall back on. Title as plain text is honest; a fabricated URL
// from an incomplete DTO would not be.
function detailFor(item: PaymentHistoryItemDto): string {
  switch (item.purpose) {
    case "listing_boost":
      return item.listingTitle
        ? `${item.boostDays ?? "?"}-day boost — ${item.listingTitle}`
        : `${item.boostDays ?? "?"}-day boost`;
    case "buyer_premium":
    case "seller_slot_pack":
      return `${item.subscriptionMonths ?? "?"} month${item.subscriptionMonths === 1 ? "" : "s"}`;
    case "agent_pro":
      return `${item.subscriptionMonths ?? "?"} month${item.subscriptionMonths === 1 ? "" : "s"}${item.agentProUnits ? ` · ${item.agentProUnits} unit${item.agentProUnits === 1 ? "" : "s"}` : ""}`;
    case "contact_reveal_credits":
      return `${item.creditPackSize ?? "?"} credits`;
    default:
      return "—";
  }
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const citySlug = typeof sp.city === "string" ? sp.city : undefined;
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const [session, { city, cityAreas, allCities }] = await Promise.all([auth(), resolvePageCityContext(citySlug)]);
  const accessToken = session?.accessToken;
  const loggedIn = isAccessTokenValid(accessToken);

  return (
    <div className="min-h-screen lg:min-h-[640px] flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <div className="flex-1 w-full max-w-[1280px] mx-auto p-8">
        <Link href="/profile" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to profile
        </Link>
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-1">Purchase history</h1>
        <p className="text-[13px] text-muted mb-6">
          Every boost, subscription, and contact-reveal credit pack you&apos;ve bought — including attempts that didn&apos;t
          go through.
        </p>

        {!loggedIn || !accessToken ? (
          <RequireLoginPrompt message="Log in to see your purchase history." />
        ) : (
          <PurchaseHistoryTable accessToken={accessToken} cursor={cursor} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function PurchaseHistoryTable({ accessToken, cursor }: { accessToken: string; cursor?: string }) {
  let page;
  try {
    page = await fetchPaymentHistory(accessToken, cursor);
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <RequireLoginPrompt message="Log in to see your purchase history." />;
    }
    throw error;
  }

  if (page.items.length === 0) {
    return <p className="text-[13px] text-muted">{cursor ? "No more purchases." : "No purchases yet."}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <HorizontalScroller ariaLabel="purchase history" contentClassName="border border-border rounded-2xl bg-surface overflow-hidden">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="p-3 text-[12px] font-bold text-muted">Date</th>
              <th className="p-3 text-[12px] font-bold text-muted">Purchase</th>
              <th className="p-3 text-[12px] font-bold text-muted">Details</th>
              <th className="p-3 text-[12px] font-bold text-muted">Amount</th>
              <th className="p-3 text-[12px] font-bold text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="p-3 text-[12.5px] text-muted whitespace-nowrap align-top">
                  {new Date(item.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3 text-[13px] text-text font-bold align-top whitespace-nowrap">
                  {PURPOSE_LABELS[item.purpose]}
                </td>
                <td className="p-3 text-[13px] text-text-soft align-top">{detailFor(item)}</td>
                <td className="p-3 text-[13px] text-text align-top whitespace-nowrap">
                  ₹{item.amount / 100}
                </td>
                <td className={`p-3 text-[12.5px] font-bold align-top whitespace-nowrap ${STATUS_STYLE[item.status]}`}>
                  {item.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScroller>

      {page.nextCursor && (
        <Link
          href={`/purchases?cursor=${encodeURIComponent(page.nextCursor)}`}
          className="text-[13px] font-bold text-green self-start"
        >
          Older purchases →
        </Link>
      )}
    </div>
  );
}
