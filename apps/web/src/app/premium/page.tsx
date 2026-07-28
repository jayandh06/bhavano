import Link from "next/link";
import { auth } from "@/auth";
import { BffAuthError, fetchProfile } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { isAccessTokenValid } from "@/lib/session";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { PremiumPlansView } from "@/components/home/PremiumPlansView";
import { PremiumPlansPublic } from "@/components/home/PremiumPlansPublic";

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const citySlug = typeof sp.city === "string" ? sp.city : undefined;
  const [session, { city, cityAreas, allCities }] = await Promise.all([auth(), resolvePageCityContext(citySlug)]);
  const accessToken = session?.accessToken;
  const loggedIn = isAccessTokenValid(accessToken);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <div className="flex-1 w-full max-w-[960px] mx-auto p-8">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-1">Plans &amp; upgrades</h1>
        <p className="text-[13px] text-muted mb-6">
          Compare free, seller, and buyer plans side by side — or subscribe when you&apos;re ready.
        </p>

        {loggedIn && accessToken ? <PremiumPlansLoggedIn accessToken={accessToken} /> : <PremiumPlansPublic />}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function PremiumPlansLoggedIn({ accessToken }: { accessToken: string }) {
  try {
    const profile = await fetchProfile(accessToken);
    return <PremiumPlansView profile={profile} />;
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <PremiumPlansPublic />;
    }
    throw error;
  }
}
