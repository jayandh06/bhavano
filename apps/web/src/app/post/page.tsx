import Link from "next/link";
import { auth } from "@/auth";
import { fetchProfile } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { isAccessTokenValid } from "@/lib/session";
import { resolveVideoEntitlement } from "@bhavano/types/videoLimits";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { PostAdWizard } from "@/components/home/PostAdWizard";
import { PostPageTracker } from "@/components/home/PostPageTracker";

export default async function PostAdPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const citySlug = typeof sp.city === "string" ? sp.city : undefined;
  // `resolvePageCityContext`'s `allCities` is fetched with `all=true` — not just the popular
  // subset — so a previously-selected tier-2 city is still a real option in the wizard's
  // dropdown, not just a dangling id with no matching entry.
  const [session, { city, cityAreas, allCities }] = await Promise.all([auth(), resolvePageCityContext(citySlug)]);
  const accessToken = session?.accessToken;
  const loggedIn = isAccessTokenValid(accessToken);

  // Resolved server-side and passed down as a plain value — the wizard must never recompute tier
  // itself from a possibly-stale agentProUntil (see resolveVideoEntitlement's doc comment). No
  // listing exists yet at posting time, so only Agent Pro (not a boost) can elevate this.
  // Defaults to the base tier if the profile fetch fails — a video-limit hiccup should never
  // block posting a listing entirely.
  const videoEntitlement = loggedIn
    ? await fetchProfile(accessToken).then(
        (profile) => resolveVideoEntitlement(profile),
        () => resolveVideoEntitlement({ agentProUntil: null }),
      )
    : resolveVideoEntitlement({ agentProUntil: null });

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <PostPageTracker loggedIn={loggedIn} />
      {/* 1280px to match every other page, so the back link and heading start at the same left
        * edge as the logo above them instead of floating in a narrower centred column. The form
        * keeps its 780px measure for readability, left-aligned rather than centred under a
        * left-aligned heading. */}
      <div className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 pb-20">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-2xl font-semibold m-0 mb-5">Post a free ad</h1>
        {/* The wizard fills the container; only the login prompt is left out of it, since a
          * one-line prompt and its button want the middle of the page rather than a left edge.
          * The wizard was capped at 780px when it was centred, which left a third of a desktop
          * screen empty once the column moved to the left. Its own grids widen with the space
          * instead — more columns, not wider fields. */}
        {/* The form, logged in or not.
          *
          * This used to be a login wall: a modal opened over an empty page on arrival, so a
          * visitor from an ad that promised a free listing met a sign-up box before seeing that
          * the form is short and free. Nothing in the wizard touches the server until Publish —
          * photos are File objects held in memory — so the account was never needed to fill it
          * in, only to submit it. The ask moved there.
          *
          * Keyed on the resolved default city: a client-side nav to /post with a different
          * ?city= is a search-param-only change on the same route, so React would otherwise
          * reuse the already-mounted wizard instance and its stale `useState(defaultCityId)`
          * init instead of picking up the new default. */}
        <div>
          <PostAdWizard
            key={city?.id ?? "none"}
            cities={allCities}
            defaultCityId={city?.id}
            accessToken={accessToken}
            loggedIn={loggedIn}
            videoEntitlement={videoEntitlement}
          />
        </div>
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}
