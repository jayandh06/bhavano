import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchListingById, fetchMessages, fetchThread } from "@/lib/bff";
import { ModerationPanel } from "@/components/ModerationPanel";

export default async function ListingModerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accessToken, userId } = await requireAdmin();

  const listing = await fetchListingById(accessToken, id).catch(() => null);
  if (!listing) notFound();

  const thread = await fetchThread(accessToken, id);
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
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Status: {listing.status} · Posted {new Date(listing.createdAt).toLocaleDateString()}
            {listing.photos.length > 0 ? ` · ${listing.photos.length} photo(s)` : " · no photos"}
          </div>
        </div>

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
