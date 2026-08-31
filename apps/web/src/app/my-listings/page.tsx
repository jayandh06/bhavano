import Link from "next/link";
import type { ListingDetailDto, ListingStatus } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import { auth } from "@/auth";
import { BffAuthError, fetchMyListings, fetchProfile } from "@/lib/bff";
import { ListingSlotMeter } from "@/components/home/ListingSlotMeter";
import { buildListingPath } from "@/lib/listingPath";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";
import { BoostButton } from "@/components/home/BoostButton";
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
      <div className="flex-1 w-full max-w-[960px] mx-auto p-8">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-5">Your listings</h1>

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to view and edit the ads you've posted." />
        ) : (
          <MyListingsGrid accessToken={session.accessToken} cityName={city?.name} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function MyListingsGrid({ accessToken, cityName }: { accessToken: string; cityName?: string }) {
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

  return (
    <div className="flex flex-col gap-3">
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
    </div>
  );
}

function MyListingRow({ item, accessToken }: { item: ListingDetailDto; accessToken: string }) {
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
          <span
            className="text-[11px] font-bold rounded-md px-2 py-0.5 border"
            style={{ color: STATUS_COLORS[item.status], borderColor: STATUS_COLORS[item.status] }}
          >
            {item.isExpired && item.status === "active" ? "Expired" : STATUS_LABELS[item.status]}
          </span>
          {item.isBoosted && (
            <span className="text-[11px] font-bold rounded-md px-2 py-0.5 border border-gold text-gold inline-flex items-center gap-1"><Icon name="featured" filled /> Featured</span>
          )}
        </div>
        <div className="text-[13px] text-muted mt-1">
          {item.price} {item.priceQualifier} · {item.area}, {item.cityName}
        </div>
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
      <div className="flex items-center gap-2.5 shrink-0">
        {canRenew && <RenewButton listingId={item.id} />}
        {item.status === "active" && !item.isExpired && !item.isBoosted && (
          <BoostButton listingId={item.id} category={item.category} />
        )}
        <Link href={buildListingPath(item)} className="text-[13px] font-bold text-text whitespace-nowrap">
          View
        </Link>
        <Link
          href={`/my-listings/${item.id}/edit`}
          className="text-[13px] font-bold text-on-green bg-green rounded-lg px-3.5 py-2 whitespace-nowrap"
        >
          Edit
        </Link>
      </div>
      {item.status === "active" && !item.isExpired && (
        <div className="basis-full border-t border-border pt-3 mt-1">
          <VideoManager listing={item} accessToken={accessToken} />
        </div>
      )}
    </div>
  );
}
