import { auth } from "@/auth";
import { fetchFavourites } from "@/lib/bff";
import { ListingCard } from "@/components/home/ListingCard";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export default async function FavouritesPage() {
  const session = await auth();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px" }}>
        <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 26, fontWeight: 600, margin: "0 0 20px" }}>
          Your favourites
        </h1>

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
    return <p style={{ color: "var(--muted)", fontSize: 14 }}>No favourites yet — tap ♡ on a listing to save it here.</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>
      {favourites.map((item) => (
        <ListingCard key={item.id} item={item} cityName={item.cityName} />
      ))}
    </div>
  );
}
