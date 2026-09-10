import Link from "next/link";
import { auth } from "@/auth";
import { BffAuthError, fetchContactRevealBalance, fetchProfile } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { ProfileForm } from "@/components/home/ProfileForm";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";
import { ContactRevealBalanceCard } from "@/components/home/ContactRevealBalanceCard";

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

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to view and edit your profile." />
        ) : (
          // Row on desktop (form left, credits/links right) — stacks to a single column on
          // mobile with DOM order doing the work: the sidebar comes after the form in markup,
          // so on mobile it lands below the form's own "Save changes" button for free, no
          // separate mobile-only ordering needed.
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1 min-w-0 w-full">
              <ProfileFields accessToken={session.accessToken} />
            </div>
            <div className="w-full lg:w-[300px] lg:shrink-0 flex flex-col gap-5">
              <ContactRevealBalanceFields accessToken={session.accessToken} />
              <div className="flex flex-col gap-1">
                <Link href="/my-listings" className="text-[13px] text-green font-bold inline-block">
                  View and edit your listings →
                </Link>
                <Link href="/purchases" className="text-[13px] text-green font-bold inline-block">
                  View your purchase history →
                </Link>
              </div>
            </div>
          </div>
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

// Own component rather than folded into ProfileFields — a failed balance fetch (BffAuthError
// aside, which the page-level redirect below already handles) shouldn't take the profile form
// down with it; the two are independent BFF calls with independent failure modes.
async function ContactRevealBalanceFields({ accessToken }: { accessToken: string }) {
  try {
    const balance = await fetchContactRevealBalance(accessToken);
    return <ContactRevealBalanceCard balance={balance} />;
  } catch (error) {
    if (error instanceof BffAuthError) return null;
    throw error;
  }
}
