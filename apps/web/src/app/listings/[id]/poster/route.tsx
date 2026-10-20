import { ImageResponse } from "next/og";
import sharp from "sharp";
import QRCode from "qrcode";
import { listingPriceText } from "@bhavano/types/priceWords";
import { fetchListingById } from "@/lib/bff";
import { taggedShareUrl } from "@/lib/shareLinks";

/** A shareable 1080x1350 poster of one ad — cover photo, title, price, location and a QR code to the
 * listing — for WhatsApp status/groups and print. Only public listing data goes on it (never a phone
 * number or email), so the route is public like the listing page itself. Part of the Featured-ad
 * share kit: docs/plans/featured-ad-benefits-and-media-limits.md.
 *
 * Two things worth knowing about how this is drawn:
 * - Ad photos are stored as WebP, which the image generator (satori) cannot draw, so the cover photo is
 *   fetched and converted to JPEG here first. Without that the photo area came out blank.
 * - A PNG cannot hold a clickable link, so the poster carries a QR code (scannable from another screen
 *   or a printout) and the share button sends the real link in the message text next to the image. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bhavano.com";
const PHOTO_W = 1080;
const PHOTO_H = 760;

/** The cover photo as a JPEG data URL, or null if it cannot be fetched/decoded (the poster then simply
 * shows the brand colour where the photo would be, rather than failing). */
async function coverPhotoDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
      .rotate()
      .resize(PHOTO_W, PHOTO_H, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await fetchListingById(id).catch(() => null);
  if (!listing) return new Response("Not found", { status: 404 });

  const price = listingPriceText(listing, "compact");
  // The legacy /listings/:id path 301s to the canonical page, and keeps the QR small and easy to scan.
  const link = taggedShareUrl(`${SITE_URL}/listings/${listing.id}`, "poster", "owner_share");
  const [photo, qr] = await Promise.all([
    coverPhotoDataUrl(listing.photosFull?.[0] ?? listing.photos?.[0] ?? null),
    QRCode.toDataURL(link, { margin: 1, width: 280, color: { dark: "#0b3d2e", light: "#ffffff" } }),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0b3d2e" }}>
        <div style={{ display: "flex", width: "100%", height: PHOTO_H, background: "#14523f" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- satori renders its own <img>
            <img src={photo} width={PHOTO_W} height={PHOTO_H} alt="" />
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
        <div style={{ display: "flex", flex: 1, padding: "40px 56px", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 12 }}>
            <div style={{ display: "flex", fontSize: 62, fontWeight: 700, color: "#d9b36b" }}>{price}</div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#efe9dc", lineHeight: 1.2 }}>
              {listing.title.length > 60 ? `${listing.title.slice(0, 57)}…` : listing.title}
            </div>
            <div style={{ display: "flex", fontSize: 32, color: "#efe9dc", opacity: 0.85 }}>
              {listing.area}, {listing.cityName}
            </div>
            <div style={{ display: "flex", marginTop: "auto", fontSize: 34, fontWeight: 700, color: "#d9b36b" }}>
              bhavano.com
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", padding: 12, background: "#ffffff", borderRadius: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- satori renders its own <img> */}
              <img src={qr} width={236} height={236} alt="" />
            </div>
            <div style={{ display: "flex", fontSize: 24, color: "#efe9dc", textAlign: "center" }}>
              Scan to see photos
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
