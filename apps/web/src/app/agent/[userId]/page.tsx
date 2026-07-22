import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchAgentStorefront } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { ListingCard } from "@/components/home/ListingCard";

export default async function AgentStorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await params;
  const sp = await searchParams;
  const citySlug = typeof sp.city === "string" ? sp.city : undefined;

  const [agent, { city, cityAreas, allCities }] = await Promise.all([
    fetchAgentStorefront(userId).catch(() => null),
    resolvePageCityContext(citySlug),
  ]);
  if (!agent) notFound();

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <div className="flex-1 w-full max-w-[1280px] mx-auto p-8">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>

        <div className="flex items-center gap-3 flex-wrap mb-1">
          <h1 className="font-lora text-[26px] font-semibold m-0">{agent.name}</h1>
          {agent.isAgentPro && (
            <span className="bg-gold text-[#3a2e0f] text-[11px] font-bold px-2.5 py-1 rounded-md">✓ Bhavano Pro</span>
          )}
        </div>
        <p className="text-[13px] text-muted mb-6">
          {agent.total} active listing{agent.total === 1 ? "" : "s"} · Member since{" "}
          {new Date(agent.memberSince).toLocaleDateString()}
        </p>

        {agent.listings.length === 0 ? (
          <p className="text-muted text-sm">No active listings right now.</p>
        ) : (
          // Not ListingGrid (which applies one cityName to every card) — an agent's listings
          // can genuinely span multiple cities, same reasoning as favourites/page.tsx.
          <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]">
            {agent.listings.map((item) => (
              <ListingCard key={item.id} item={item} cityName={item.cityName} />
            ))}
          </div>
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}
