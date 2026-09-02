import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchListingById, fetchListingOwner, fetchMessages, fetchThread } from "@/lib/bff";
import { ModerationPanel } from "@/components/ModerationPanel";
import { RotatablePhotoGrid } from "@/components/RotatablePhotoGrid";
import { formatDate } from "@/lib/formatDateTime";

export default async function ListingModerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accessToken, userId } = await requireAdmin();

  const listing = await fetchListingById(accessToken, id).catch(() => null);
  if (!listing) notFound();

  const [thread, owner] = await Promise.all([
    fetchThread(accessToken, id),
    fetchListingOwner(accessToken, id),
  ]);
  const messages = await fetchMessages(accessToken, thread.id);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to queue
        </Link>

        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20, background: "var(--surface)" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{listing.title}</h1>
          <div style={{ fontSize: 14, color: "var(--text-soft)", marginBottom: 4 }}>
            {listing.price} {listing.priceQualifier} · {listing.category} · {listing.transactionType}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            {listing.area}, {listing.cityName}
          </div>
          {listing.specs.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 8 }}>Specs: {listing.specs.join(", ")}</div>
          )}
          {Object.keys(listing.attributes).length > 0 && (
            <div style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 8 }}>
              {Object.entries(listing.attributes)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </div>
          )}
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: listing.photosFull.length > 0 || listing.videos.length > 0 ? 12 : 0 }}>
            Status: {listing.status} · Posted {formatDate(listing.createdAt)}
            {listing.photosFull.length > 0 ? ` · ${listing.photosFull.length} photo(s)` : " · no photos"}
            {listing.videos.length > 0 && ` · ${listing.videos.length} video(s)`}
          </div>

          {listing.photosFull.length > 0 && (
            <div style={{ marginBottom: listing.videos.length > 0 ? 10 : 0 }}>
              <RotatablePhotoGrid
                listingId={listing.id}
                title={listing.title}
                photos={listing.photosFull.map((url, i) => ({
                  url,
                  photoNo: listing.photoNos[i],
                  updatedAt: listing.photoUpdatedAts[i],
                }))}
              />
            </div>
          )}

          {listing.videos.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {listing.videos.map((video) => (
                <div key={video.id} style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                  {video.status === "done" ? (
                    // Plain <video>, same reasoning as the photo grid above — a moderation
                    // target, not site content.
                    <video src={video.url} poster={video.posterUrl} controls style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: 140,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12.5,
                        color: "var(--muted)",
                        background: "var(--surface-alt)",
                      }}
                    >
                      {video.status === "failed" ? "Processing failed" : "Processing…"}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "4px 8px" }}>
                    Video {video.videoNo} · {video.durationSec}s · {video.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {owner && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 20,
              background: "var(--surface)",
            }}
          >
            <div style={{ fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>Owner: </span>
              {owner.name ?? "Unnamed"} {[owner.phone, owner.email].filter(Boolean).length > 0 && `(${[owner.phone, owner.email].filter(Boolean).join(", ")})`}
            </div>
            <Link href={`/users/${owner.id}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>
              View owner activity →
            </Link>
          </div>
        )}

        <ModerationPanel
          listingId={listing.id}
          moderationState={listing.moderationState}
          adminReviewed={listing.adminReviewed}
          messages={messages}
          currentUserId={userId}
        />
      </div>
    </div>
  );
}
