import Link from "next/link";
import { auth } from "@/auth";
import { BffAuthError, fetchProfile } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { ProfileForm } from "@/components/home/ProfileForm";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export default async function ProfilePage({
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
      <div className="flex-1 w-full max-w-[1280px] mx-auto p-8">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-1">Your profile</h1>

        {session?.accessToken && (
          <Link href="/my-listings" className="text-[13px] text-green font-bold mb-5 inline-block">
            View and edit your listings →
          </Link>
        )}

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to view and edit your profile." />
        ) : (
          <ProfileFields accessToken={session.accessToken} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function ProfileFields({ accessToken }: { accessToken: string }) {
  let profile;
  try {
    profile = await fetchProfile(accessToken);
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <RequireLoginPrompt message="Log in to view and edit your profile." />;
    }
    throw error;
  }
  return <ProfileForm profile={profile} />;
}
