import Link from "next/link";
import { auth } from "@/auth";
import { fetchProfile } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { isAccessTokenValid } from "@/lib/session";
import { resolveVideoEntitlement } from "@bhavano/types/videoLimits";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { PostAdWizard } from "@/components/home/PostAdWizard";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

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
      <div className="flex-1 w-full max-w-[780px] mx-auto px-8 pt-6 pb-20">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-2xl font-semibold m-0 mb-5">Post a free ad</h1>
        {!loggedIn ? (
          <RequireLoginPrompt message="Log in to post your ad." />
        ) : (
          // Keyed on the resolved default city: a client-side nav to /post with a different
          // ?city= is a search-param-only change on the same route, so React would otherwise
          // reuse the already-mounted wizard instance and its stale `useState(defaultCityId)`
          // init instead of picking up the new default.
          <PostAdWizard
            key={city?.id ?? "none"}
            cities={allCities}
            defaultCityId={city?.id}
            accessToken={accessToken}
            videoEntitlement={videoEntitlement}
          />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}
