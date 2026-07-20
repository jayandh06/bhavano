import Link from "next/link";
import { auth } from "@/auth";
import { fetchFavourites } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { Footer } from "@/components/home/Footer";
import { ListingCard } from "@/components/home/ListingCard";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export default async function FavouritesPage({
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
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-5">Your favourites</h1>

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to see the listings you've favourited." />
        ) : (
          <FavouritesGrid accessToken={session.accessToken} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function FavouritesGrid({ accessToken }: { accessToken: string }) {
  const favourites = await fetchFavourites(accessToken);

  if (favourites.length === 0) {
    return <p className="text-muted text-sm">No favourites yet — tap ♡ on a listing to save it here.</p>;
  }

  return (
    <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]">
      {favourites.map((item) => (
        <ListingCard key={item.id} item={item} cityName={item.cityName} />
      ))}
    </div>
  );
}
