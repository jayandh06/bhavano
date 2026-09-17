import Link from "next/link";
import { auth } from "@/auth";
import { BffAuthError, fetchMatchingRequirements } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export const metadata = {
  title: "People looking for what you have",
  description: "Property requirements matching the listings you've posted on Bhavano.",
  // Scoped to one owner's own inventory, so there is nothing here to index.
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

/**
 * Demand matching an owner's own listings — where the match email lands.
 *
 * Not the public feed the plan defers: this is scoped to the viewer's own inventory and reached
 * from a notification about it, which is what makes it useful at a volume where nobody would
 * browse a marketplace of requirements. It carries no seeker identity at all — until the
 * messaging-first contact path exists, an owner responds by listing the thing, and we connect
 * the two. See docs/plans/property-requirements-demand-side.md.
 */
export default async function MatchingRequirementsPage({
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
        <Link href="/my-listings" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to your listings
        </Link>
        <h1 className="font-lora text-2xl font-semibold m-0 mb-1.5">People looking for what you have</h1>
        <p className="text-muted text-[13.5px] m-0 mb-6">
          Searches that came up empty in the areas and categories you&apos;ve listed in. If you have
          something suitable, posting it is the fastest way to reach them.
        </p>

        {!session?.accessToken ? (
          <RequireLoginPrompt
            message="Log in to see demand matching your listings."
            redirectTo="/requirements/matching"
          />
        ) : (
          <MatchList accessToken={session.accessToken} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function MatchList({ accessToken }: { accessToken: string }) {
  let matches;
  try {
    matches = await fetchMatchingRequirements(accessToken);
  } catch (error) {
    if (error instanceof BffAuthError) {
      return (
        <RequireLoginPrompt
          message="Log in to see demand matching your listings."
          redirectTo="/requirements/matching"
        />
      );
    }
    throw error;
  }

  if (matches.length === 0) {
    return (
      <div className="border border-border rounded-xl bg-surface p-7 text-center">
        <p className="m-0 mb-4 text-[13.5px] text-muted">
          Nothing right now. We match on where and what you&apos;ve already listed, so this fills up
          as people search in those areas.
        </p>
        <Link href="/post" className="text-green font-bold text-[13.5px]">
          Post a listing →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {matches.map((match) => (
        <div key={match.id} className="border border-border rounded-xl bg-surface p-5">
          <div className="font-lora text-lg font-bold">{match.searchLabel}</div>
          <div className="text-[13px] text-muted mt-1">
            {[
              match.areaName ?? match.cityName,
              match.bedrooms ? `${match.bedrooms} BHK` : null,
              match.maxPrice ? `up to ₹${match.maxPrice.toLocaleString("en-IN")}` : null,
              match.moveInBy ? `needed by ${dateFormatter.format(new Date(match.moveInBy))}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {match.note && <p className="text-[13.5px] m-0 mt-3 text-text-soft">“{match.note}”</p>}
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[12px] text-muted">
              Asked {dateFormatter.format(new Date(match.createdAt))} · contact details aren&apos;t shared
            </span>
            <Link
              href="/post"
              className="bg-green text-on-green rounded-lg px-4 py-2 text-[13px] font-bold no-underline"
            >
              Post something matching
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
