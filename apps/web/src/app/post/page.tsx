import Link from "next/link";
import { fetchCities } from "@/lib/bff";
import { resolveCity } from "@/lib/browseRoute";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { PostAdWizard } from "@/components/home/PostAdWizard";

// TEMP(auth-gate): posting is open without login for now.
export default async function PostAdPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // `all=true` — not just the popular subset — so a previously-selected tier-2 city (carried in
  // via ?city=, see HeaderAuthButtons) is still a real option in the wizard's dropdown, not just
  // a dangling id with no matching entry.
  const citySlug = typeof sp.city === "string" ? sp.city : undefined;
  const [cities, defaultCity] = await Promise.all([
    fetchCities(undefined, true),
    citySlug ? resolveCity(citySlug) : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader />
      <div className="flex-1 w-full max-w-[780px] mx-auto px-8 pt-6 pb-20">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-2xl font-semibold m-0 mb-5">Post a free ad</h1>
        <PostAdWizard cities={cities} defaultCityId={defaultCity?.id} />
      </div>
      <Footer />
    </div>
  );
}
