import Link from "next/link";
import { auth } from "@/auth";
import { BffAuthError, fetchProfile } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { isAccessTokenValid } from "@/lib/session";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";
import { SubscribeButton } from "@/components/home/SubscribeButton";

export default async function PremiumPage({
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
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-1">Bhavano Plus &amp; Pro</h1>
        <p className="text-[13px] text-muted mb-6">Upgrade your buying or selling experience on Bhavano.</p>

        {!isAccessTokenValid(accessToken) ? (
          <RequireLoginPrompt message="Log in to view and manage your subscriptions." />
        ) : (
          <PremiumTiers accessToken={accessToken} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function PremiumTiers({ accessToken }: { accessToken: string }) {
  let profile;
  try {
    profile = await fetchProfile(accessToken);
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <RequireLoginPrompt message="Log in to view and manage your subscriptions." />;
    }
    throw error;
  }

  const premiumUntil = profile.premiumUntil ? new Date(profile.premiumUntil) : null;
  const agentProUntil = profile.agentProUntil ? new Date(profile.agentProUntil) : null;
  const isPremium = !!premiumUntil && premiumUntil.getTime() > Date.now();
  const isAgentPro = !!agentProUntil && agentProUntil.getTime() > Date.now();

  return (
    <div className="flex flex-col gap-6">
      <section className="border border-border rounded-2xl p-6 bg-surface">
        <div className="font-lora text-xl font-bold text-text mb-1">⭐ Bhavano Plus</div>
        <p className="text-[13px] text-muted mb-4 m-0">For buyers &amp; renters — get noticed, get answered faster.</p>
        <ul className="text-[13px] text-text-soft m-0 mb-4 pl-5 list-disc flex flex-col gap-1">
          <li>
            <strong>Early-access alerts</strong> — save a search and get notified the instant a matching listing
            posts, before you&apos;d ever spot it browsing
          </li>
          <li>A &ldquo;✓ Verified Buyer&rdquo; badge shown to sellers on every message you send</li>
          <li>Priority visibility in sellers&apos; inboxes — get answered faster than free users</li>
        </ul>
        {isPremium && premiumUntil ? (
          <div className="flex flex-col gap-2 items-start">
            <p className="text-[13px] font-bold text-green m-0">Active until {premiumUntil.toLocaleDateString()}</p>
            <Link href="/saved-searches" className="text-[13px] font-bold text-green">
              Manage your saved searches →
            </Link>
          </div>
        ) : (
          <SubscribeButton tier="buyerPremium" />
        )}
      </section>

      <section className="border border-border rounded-2xl p-6 bg-surface">
        <div className="font-lora text-xl font-bold text-text mb-1">🏢 Agent/Broker Pro</div>
        <p className="text-[13px] text-muted mb-4 m-0">For agents &amp; brokers — post more, stand out more.</p>
        <ul className="text-[13px] text-text-soft m-0 mb-4 pl-5 list-disc flex flex-col gap-1">
          <li>No posting-frequency cap — publish as many listings as you need</li>
          <li>A branded public storefront page listing all your active listings</li>
          <li>A &ldquo;Bhavano Pro&rdquo; badge shown on your storefront</li>
        </ul>
        {isAgentPro && agentProUntil ? (
          <div className="flex flex-col gap-2 items-start">
            <p className="text-[13px] font-bold text-green m-0">Active until {agentProUntil.toLocaleDateString()}</p>
            <Link href={`/agent/${profile.id}`} className="text-[13px] font-bold text-green">
              View your storefront →
            </Link>
          </div>
        ) : (
          <SubscribeButton tier="agentPro" />
        )}
      </section>
    </div>
  );
}
