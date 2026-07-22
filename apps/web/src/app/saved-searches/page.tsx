import Link from "next/link";
import { auth } from "@/auth";
import { BffAuthError, fetchCities, fetchProfile, fetchSavedSearches } from "@/lib/bff";
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
      <div className="flex-1 w-full max-w-[720px] mx-auto p-8">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-1">Saved searches</h1>
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
  let profile;
  try {
    profile = await fetchProfile(accessToken);
  } catch (error) {
    if (error instanceof BffAuthError) return <RequireLoginPrompt message="Log in to manage your saved searches." />;
    throw error;
  }

  const isPremium = !!profile.premiumUntil && new Date(profile.premiumUntil).getTime() > Date.now();
  if (!isPremium) {
    return (
      <div className="border border-border rounded-2xl p-6 bg-surface text-center">
        <p className="text-sm text-text-soft mb-4 m-0">
          Saved search alerts are a Bhavano Plus benefit — subscribe to get notified the moment a matching listing
          goes up, before anyone else does.
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

  const [searches, cities] = await Promise.all([fetchSavedSearches(accessToken), fetchCities(undefined, true)]);
  return <SavedSearchesManager initial={searches} cities={cities} />;
}
