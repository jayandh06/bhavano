import Link from "next/link";
import { auth } from "@/auth";
import { BffAuthError, fetchMyRequirements } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";
import { MyRequirementCard } from "@/components/home/MyRequirementCard";

export const metadata = {
  title: "What you're looking for",
  description: "The property requirements you've told Bhavano about, and how they're doing.",
  // Personal, logged-in content — nothing here should ever be indexed.
  robots: { index: false, follow: false },
};

/** Phase 1 of docs/plans/property-requirements-demand-side.md. Deliberately not the feature's
 * centrepiece — the engagement data says this app's seekers rarely return to a page, so the
 * product is the notification and this page exists so nobody feels their post vanished, and so
 * the minority who do come back can renew, close, or add detail. */
export default async function MyRequirementsPage({
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
      <div className="flex-1 w-full max-w-[880px] mx-auto px-4 sm:px-8 pt-6 pb-20">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-2xl font-semibold m-0 mb-1.5">What you&apos;re looking for</h1>
        <p className="text-muted text-[13.5px] m-0 mb-6">
          Searches that came up empty, which we&apos;re keeping an eye on for you.
        </p>

        {!session?.accessToken ? (
          <RequireLoginPrompt
            message="Log in to see what you've asked us to look out for."
            redirectTo="/my-requirements"
          />
        ) : (
          <RequirementsList accessToken={session.accessToken} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function RequirementsList({ accessToken }: { accessToken: string }) {
  let requirements;
  try {
    requirements = await fetchMyRequirements(accessToken);
  } catch (error) {
    if (error instanceof BffAuthError) {
      return (
        <RequireLoginPrompt
          message="Log in to see what you've asked us to look out for."
          redirectTo="/my-requirements"
        />
      );
    }
    throw error;
  }

  if (requirements.length === 0) {
    return (
      <div className="border border-border rounded-xl bg-surface p-7 text-center">
        <p className="m-0 mb-4 text-[13.5px] text-muted">
          Nothing here yet. When a search of yours comes up empty, you can ask us to keep looking —
          we&apos;ll tell you the moment something matches.
        </p>
        <Link href="/" className="text-green font-bold text-[13.5px]">
          Start searching →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {requirements.map((requirement) => (
        <MyRequirementCard key={requirement.id} requirement={requirement} />
      ))}
    </div>
  );
}
