import Link from "next/link";
import { auth } from "@/auth";
import { fetchFavourites } from "@/lib/bff";
import { ListingCard } from "@/components/home/ListingCard";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export default async function FavouritesPage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="max-w-[1280px] mx-auto p-8">
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
