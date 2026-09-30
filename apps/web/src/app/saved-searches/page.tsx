import Link from "next/link";
import { auth } from "@/auth";
import { BffAuthError, fetchCities, fetchSavedSearchAllowance, fetchSavedSearches } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { isAccessTokenValid } from "@/lib/session";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";
import { SavedSearchesManager } from "@/components/home/SavedSearchesManager";

export default async function SavedSearchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const citySlug = typeof sp.city === "string" ? sp.city : undefined;
  const [session, { city, cityAreas, allCities }] = await Promise.all([auth(), resolvePageCityContext(citySlug)]);
  const accessToken = session?.accessToken;

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <div className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 pb-20">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-2xl font-semibold m-0 mb-1">Saved searches</h1>
        <p className="text-[13px] text-muted mb-6">
          Get notified the moment a new listing matches your criteria — before you&apos;d ever spot it browsing.
        </p>

        {!isAccessTokenValid(accessToken) ? (
          <RequireLoginPrompt message="Log in to manage your saved searches." />
        ) : (
          <SavedSearchesGate accessToken={accessToken} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function SavedSearchesGate({ accessToken }: { accessToken: string }) {
  let allowance;
  try {
    allowance = await fetchSavedSearchAllowance(accessToken);
  } catch (error) {
    if (error instanceof BffAuthError) return <RequireLoginPrompt message="Log in to manage your saved searches." />;
    throw error;
  }

  // Everyone gets a free quota (2 alerts, admin-configurable) before Plus is ever required — see
  // SavedSearchesService.alertAllowance's own doc for why this replaced a Plus-only gate that made
  // the whole feature unreachable (there have never been any Plus subscribers). This only turns
  // away someone who has used their free quota *and* isn't a Plus subscriber.
  if (!allowance.canCreate) {
    return (
      <div className="border border-border rounded-2xl p-6 bg-surface text-center">
        <p className="text-sm text-text-soft mb-4 m-0">
          You&apos;ve used your free saved search alerts. Subscribe to Bhavano Plus for unlimited alerts — get
          notified the moment a matching listing goes up, before anyone else does.
        </p>
        <Link
          href="/premium"
          className="bg-green text-on-green border-0 rounded-lg px-7 py-3 text-sm font-bold inline-block"
        >
          Get Bhavano Plus →
        </Link>
      </div>
    );
  }

  const [searches, allCities] = await Promise.all([fetchSavedSearches(accessToken), fetchCities(undefined, true)]);
  // Only the 37 ad-targeted cities (see docs/plans/serve-only-ad-targeted-cities.md) — same
  // `isServed` filter every other city picker in the app already applies (LocationPicker, /cities).
  // An alert for a city we don't actually advertise in has very little to ever match.
  const cities = allCities.filter((city) => city.isServed);
  return (
    <SavedSearchesManager
      initial={searches}
      cities={cities}
      freeRemaining={allowance.source === "free" ? allowance.freeRemaining : undefined}
    />
  );
}
