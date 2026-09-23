import { Suspense } from "react";
import Link from "next/link";
import type { ListingDetailDto, ListingStatus } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import { auth } from "@/auth";
import { BffAuthError, fetchMyListings, fetchProfile, previewBoostPricing } from "@/lib/bff";
import { ACTIVE_PROMO_CODE } from "@bhavano/types/promoCode";
import { ListingSlotMeter } from "@/components/home/ListingSlotMeter";
import { buildListingPath } from "@/lib/listingPath";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";
import { BoostButton } from "@/components/home/BoostButton";
import { InstantAlertsButton } from "@/components/home/InstantAlertsButton";
import { AutoOpenPurchaseModal } from "@/components/home/AutoOpenPurchaseModal";
import {
  AutoOpenPublishCheckout,
  CompletePublishPaymentButton,
  PublishCheckoutRecoveryProvider,
} from "@/components/home/PublishCheckoutRecovery";
import { RenewButton } from "@/components/home/RenewButton";
import { VideoManager } from "@/components/home/VideoManager";
import { daysUntil } from "@/lib/listingExpiry";
import { Icon } from "@/components/home/Icon";

/** How far ahead of expiry the Renew affordance appears — mirrors the BFF's expiry-reminder
 * job, so the in-app action shows up at the same time the reminder email/SMS goes out. */
const RENEW_WINDOW_DAYS = 7;

const renewedAtFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

const STATUS_LABELS: Record<ListingStatus, string> = {
  active: "Active",
  sold: "Sold",
  rented: "Rented",
  deactivated: "Deactivated",
};

const STATUS_COLORS: Record<ListingStatus, string> = {
  active: "var(--green)",
  sold: "var(--muted)",
  rented: "var(--muted)",
  deactivated: "#b3413a",
};

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const citySlug = typeof sp.city === "string" ? sp.city : undefined;
  const [session, { city, cityAreas, allCities }] = await Promise.all([auth(), resolvePageCityContext(citySlug)]);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <div className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 pb-20">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-2xl font-semibold m-0 mb-5">Your listings</h1>

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to view and edit the ads you've posted." />
        ) : (
          <MyListingsGrid
            accessToken={session.accessToken}
            cityName={city?.name}
            openBoostId={typeof sp.openBoost === "string" ? sp.openBoost : undefined}
            openPublishCheckoutId={
              typeof sp.openPublishCheckout === "string" ? sp.openPublishCheckout : undefined
            }
          />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function MyListingsGrid({
  accessToken,
  cityName,
  openBoostId,
}: {
  accessToken: string;
  cityName?: string;
  /** `?openBoost=<id>` — set when the visitor arrived from a Boost link in an email or WhatsApp
   * message, which is the case that needs its price resolved here rather than in the browser. */
  openBoostId?: string;
  openPublishCheckoutId?: string;
}) {
  let listings;
  let profile;
  try {
    [listings, profile] = await Promise.all([fetchMyListings(accessToken), fetchProfile(accessToken)]);
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <RequireLoginPrompt message="Log in to view and edit the ads you've posted." />;
    }
    throw error;
  }

  if (listings.length === 0) {
    return (
      <>
        <ListingSlotMeter profile={profile} />
        <p className="text-muted text-sm">
        You haven&apos;t posted anything yet —{" "}
        <Link href={cityName ? `/post?city=${slugify(cityName)}` : "/post"} className="text-green font-bold">
          post your first ad
        </Link>
        .
      </p>
      </>
    );
  }

  const activeListings = listings.filter((item) => !item.isExpired);
  const pastListings = listings.filter((item) => item.isExpired);

  // The deep-linked dialog's price, resolved server-side.
  //
  // It used to be fetched by the dialog itself on mount, which is fine for an in-app click but not
  // for arriving from a message: the visitor logs in first, and the price then depended on a
  // client round trip racing a just-established session and a `router.refresh()` still in flight.
  // The symptom was a dialog that showed no price until it was touched. Resolving it here means
  // the price is part of the page the browser is handed — there is no timing left to get wrong.
  //
  // Best-effort: a failure leaves the dialog to its own fetch (with its retries), which is exactly
  // the behaviour this replaces rather than a new failure mode.
  const openBoostListing = openBoostId ? listings.find((item) => item.id === openBoostId) : undefined;
  const openBoostPricing = openBoostListing
    ? await previewBoostPricing(accessToken, openBoostListing.category, ACTIVE_PROMO_CODE).catch(
        (error: unknown) => {
          // Logged, not swallowed. If this ever fails, the dialog falls back to fetching for
          // itself and the visitor may see no price — and a silent catch is why the last round of
          // this bug had to be diagnosed from a screenshot instead of a log line.
          console.error(
            `[my-listings] boost price preview failed for ${openBoostListing.id} (${openBoostListing.category}):`,
            error instanceof Error ? error.message : error,
          );
          return undefined;
        },
      )
    : undefined;

  return (
    <PublishCheckoutRecoveryProvider>
      <Suspense fallback={null}>
        <AutoOpenPublishCheckout listings={listings} />
      </Suspense>
      <AutoOpenPurchaseModal
        listings={listings.map((l) => ({ id: l.id, category: l.category }))}
        initialPricing={openBoostPricing}
      />
      <ListingSlotMeter profile={profile} />
      {activeListings.map((item) => (
        <MyListingRow key={item.id} item={item} accessToken={accessToken} />
      ))}
      {pastListings.length > 0 && (
        <>
          <h2 className="font-lora text-[19px] font-semibold m-0 mt-5">Past listings</h2>
          <p className="text-[13px] text-muted m-0 -mt-1">
            These have expired and are no longer visible to buyers. Renew one to put it back up.
          </p>
          {pastListings.map((item) => (
            <MyListingRow key={item.id} item={item} accessToken={accessToken} />
          ))}
        </>
      )}
    </PublishCheckoutRecoveryProvider>
  );
}

function MyListingRow({ item, accessToken }: { item: ListingDetailDto; accessToken: string }) {
  const isPendingPublish = item.publishState === "pending_checkout";
  const daysLeft = daysUntil(item.expiresAt);
  // A negative value still satisfies <= 7, so this covers both the pre-expiry window and any
  // time after it lapsed — a listing never becomes un-renewable just by sitting expired.
  const canRenew = item.status === "active" && daysLeft <= RENEW_WINDOW_DAYS;
  const lastRenewedAt = item.renewalHistory?.[0]?.renewedAt;

  return (
    <div className="flex flex-wrap justify-between items-center gap-4 border border-border rounded-[10px] p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-bold text-[15px]">{item.title}</span>
          {isPendingPublish ? (
            <span className="text-[11px] font-bold rounded-md px-2 py-0.5 border border-[#b3413a] text-[#b3413a]">
              Payment incomplete
            </span>
          ) : (
            <span
              className="text-[11px] font-bold rounded-md px-2 py-0.5 border"
              style={{ color: STATUS_COLORS[item.status], borderColor: STATUS_COLORS[item.status] }}
            >
              {item.isExpired && item.status === "active" ? "Expired" : STATUS_LABELS[item.status]}
            </span>
          )}
          {item.isBoosted && (
            <span className="text-[11px] font-bold rounded-md px-2 py-0.5 border border-gold text-gold inline-flex items-center gap-1"><Icon name="featured" filled /> Featured</span>
          )}
        </div>
        <div className="text-[13px] text-muted mt-1">
          {item.price} {item.priceQualifier} · {item.area}, {item.cityName}
        </div>
        {isPendingPublish && (
          <p className="text-[12.5px] text-[#b3413a] m-0 mt-1.5">Not visible to buyers until you complete payment.</p>
        )}
        <div className="flex gap-3 text-[11.5px] text-muted mt-1.5">
          <span className="flex items-center gap-1"><Icon name="eye" /> {item.viewCount}</span>
          <span className="flex items-center gap-1"><Icon name="heart" /> {item.likeCount}</span>
          {canRenew && <span>{item.isExpired ? "Expired" : `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}</span>}
        </div>
        {item.renewCount > 0 && (
          <div className="text-[11.5px] text-muted mt-1">
            Renewed {item.renewCount} time{item.renewCount === 1 ? "" : "s"}
            {lastRenewedAt && ` · last on ${renewedAtFormatter.format(new Date(lastRenewedAt))}`}
          </div>
        )}
      </div>
      {/* No `shrink-0` here on purpose — it disabled this group's own `flex-wrap`. Once the
        * outer row (above) wraps this group onto its own line at a narrow width, `shrink-0` kept
        * it sized to the sum of every button present (Renew + Boost + Instant Alerts + View +
        * Edit, whichever combination applies) rather than the card's actual available width, so
        * the rightmost button — Edit, last in this list — rendered past the card/viewport edge
        * with nothing to catch the overflow. Removing it lets the group shrink to fit, so its own
        * `flex-wrap` actually gets to do its job: buttons wrap onto a second line inside the
        * card instead of running off it. */}
      <div className="flex flex-wrap items-center gap-2.5">
        {isPendingPublish ? (
          <CompletePublishPaymentButton listing={item} />
        ) : (
          <>
            {canRenew && <RenewButton listingId={item.id} />}
            {item.status === "active" && !item.isExpired && !item.isBoosted && (
              <BoostButton listingId={item.id} category={item.category} />
            )}
            {item.status === "active" && !item.isExpired && !item.hasInstantAlerts && (
              <InstantAlertsButton listingId={item.id} />
            )}
            <Link
              href={buildListingPath(item)}
              aria-label="View listing"
              title="View listing"
              className="text-[15px] font-bold text-green border-[1.5px] border-green rounded-lg px-2.5 py-2 inline-flex items-center cursor-pointer bg-transparent"
            >
              <Icon name="eye" />
            </Link>
          </>
        )}
        <Link
          href={`/my-listings/${item.id}/edit`}
          aria-label="Edit listing"
          title="Edit listing"
          className="text-[15px] font-bold text-on-green bg-green rounded-lg px-2.5 py-2 inline-flex items-center"
        >
          <Icon name="edit" />
        </Link>
      </div>
      {item.status === "active" && !item.isExpired && !isPendingPublish && (
        <div className="basis-full border-t border-border pt-3 mt-1">
          <VideoManager listing={item} accessToken={accessToken} />
        </div>
      )}
    </div>
  );
}
