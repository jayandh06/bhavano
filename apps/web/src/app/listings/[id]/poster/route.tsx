import { ImageResponse } from "next/og";
import { listingPriceText } from "@bhavano/types/priceWords";
import { fetchListingById } from "@/lib/bff";
import { buildListingPath } from "@/lib/listingPath";

/** A shareable 1080x1350 poster of one ad — cover photo, title, price, location and the Bhavano
 * address — for WhatsApp status/groups and print. Only public listing data goes on it (never a phone
 * number or email), so the route is public like the listing page itself. Part of the Featured-ad
 * share kit: docs/plans/featured-ad-benefits-and-media-limits.md. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bhavano.com";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await fetchListingById(id).catch(() => null);
  if (!listing) return new Response("Not found", { status: 404 });

  const photo = listing.photosFull?.[0] ?? listing.photos?.[0] ?? null;
  const price = listingPriceText(listing, "compact");
  const address = `${SITE_URL.replace(/^https?:\/\//, "")}${buildListingPath(listing)}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0b3d2e" }}>
        <div style={{ display: "flex", width: "100%", height: 760, background: "#14523f" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- satori renders its own <img>
            <img src={photo} width={1080} height={760} style={{ objectFit: "cover" }} alt="" />
          ) : null}
          {listing.isBoosted ? (
            <div
              style={{
                position: "absolute",
                top: 36,
                left: 36,
                display: "flex",
                padding: "10px 26px",
                borderRadius: 999,
                background: "#d9b36b",
                color: "#0b3d2e",
                fontSize: 34,
                fontWeight: 700,
              }}
            >
              Featured
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "44px 56px", gap: 14, flex: 1 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#d9b36b" }}>{price}</div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#efe9dc", lineHeight: 1.2 }}>
            {listing.title.length > 70 ? `${listing.title.slice(0, 67)}…` : listing.title}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#efe9dc", opacity: 0.85 }}>
            {listing.area}, {listing.cityName}
          </div>
          <div style={{ display: "flex", marginTop: "auto", fontSize: 30, color: "#d9b36b" }}>
            See photos and message the owner: {address}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
