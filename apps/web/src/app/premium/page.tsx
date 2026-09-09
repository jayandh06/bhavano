import Link from "next/link";
import { auth } from "@/auth";
import { BffAuthError, fetchContactRevealSettings, fetchProfile } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { isAccessTokenValid } from "@/lib/session";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { PremiumPlansView } from "@/components/home/PremiumPlansView";
import { PremiumPlansPublic } from "@/components/home/PremiumPlansPublic";
import type { ContactRevealSettingsDto } from "@bhavano/types";

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const citySlug = typeof sp.city === "string" ? sp.city : undefined;
  const [session, { city, cityAreas, allCities }, contactRevealSettings] = await Promise.all([
    auth(),
    resolvePageCityContext(citySlug),
    // Not gated on login — this is public pricing info, same as every other plan on this page.
    fetchContactRevealSettings(),
  ]);
  const accessToken = session?.accessToken;
  const loggedIn = isAccessTokenValid(accessToken);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <div className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 pb-20">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-2xl font-semibold m-0 mb-1">Plans &amp; upgrades</h1>
        <p className="text-[13px] text-muted mb-6">
          Compare free, seller, and buyer plans side by side — or subscribe when you&apos;re ready.
        </p>

        {loggedIn && accessToken ? (
          <PremiumPlansLoggedIn accessToken={accessToken} contactRevealSettings={contactRevealSettings} />
        ) : (
          <PremiumPlansPublic contactRevealSettings={contactRevealSettings} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function PremiumPlansLoggedIn({
  accessToken,
  contactRevealSettings,
}: {
  accessToken: string;
  contactRevealSettings: ContactRevealSettingsDto;
}) {
  try {
    const profile = await fetchProfile(accessToken);
    return <PremiumPlansView profile={profile} contactRevealSettings={contactRevealSettings} />;
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <PremiumPlansPublic contactRevealSettings={contactRevealSettings} />;
    }
    throw error;
  }
}
