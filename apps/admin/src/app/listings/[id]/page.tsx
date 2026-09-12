import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/requireAdmin";
import type { ListingEditLogEntryDto } from "@bhavano/types";
import {
  fetchListingById,
  fetchListingConversations,
  fetchListingEditHistory,
  fetchListingEngagement,
  fetchListingOwner,
  fetchMessages,
  fetchThread,
} from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { ModerationPanel } from "@/components/ModerationPanel";
import { RotatablePhotoGrid } from "@/components/RotatablePhotoGrid";
import { ConversationsTable } from "@/components/ConversationsTable";
import { Pagination } from "@/components/Pagination";
import { formatDate, formatDateTime } from "@/lib/formatDateTime";

const LIKED_PARAM_NAMES = { page: "likedPage", limit: "likedLimit" };
const MSG_PARAM_NAMES = { page: "msgPage", limit: "msgLimit" };
const HISTORY_PARAM_NAMES = { page: "historyPage", limit: "historyLimit" };

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Edited",
  approved: "Approved",
  flagged: "Flagged",
  status_changed: "Status changed",
  photo_added: "Photo added",
  photo_removed: "Photo removed",
  video_added: "Video added",
  video_removed: "Video removed",
};

/** `changes` values are `unknown` (see ListingFieldChange) since different actions touch
 * completely different field types — stringified generically rather than assuming a shape. */
function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function EditHistoryEntry({ entry }: { entry: ListingEditLogEntryDto }) {
  const actorLabel =
    entry.actorType === "system"
      ? "System (bulk import)"
      : entry.actorName
        ? `${entry.actorName} (${entry.actorType})`
        : `Unknown ${entry.actorType}`;
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span style={{ fontWeight: 700 }}>{ACTION_LABELS[entry.action] ?? entry.action}</span>
        <span style={{ color: "var(--muted)" }}>{formatDateTime(entry.createdAt)}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{actorLabel}</div>
      {entry.changes && Object.keys(entry.changes).length > 0 && (
        <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", fontSize: 12 }}>
          {Object.entries(entry.changes).map(([field, change]) => (
            <li key={field} style={{ color: "var(--text-soft)" }}>
              <strong>{field}</strong>: {formatChangeValue(change.before)} → {formatChangeValue(change.after)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function ListingModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { accessToken, userId } = await requireAdmin();

  const listing = await fetchListingById(accessToken, id).catch(() => null);
  if (!listing) notFound();

  const likedPage = parsePage(str(sp.likedPage));
  const likedLimit = parsePageSize(str(sp.likedLimit));
  const msgPage = parsePage(str(sp.msgPage));
  const msgLimit = parsePageSize(str(sp.msgLimit));
  const historyPage = parsePage(str(sp.historyPage));
  const historyLimit = parsePageSize(str(sp.historyLimit));

  const [thread, owner, engagement, conversations, history] = await Promise.all([
    fetchThread(accessToken, id),
    fetchListingOwner(accessToken, id),
    fetchListingEngagement(accessToken, id, {
      offset: (likedPage - 1) * likedLimit,
      limit: likedLimit,
    }),
    fetchListingConversations(accessToken, id, {
      offset: (msgPage - 1) * msgLimit,
      limit: msgLimit,
    }),
    fetchListingEditHistory(accessToken, id, {
      offset: (historyPage - 1) * historyLimit,
      limit: historyLimit,
    }),
  ]);
  const messages = await fetchMessages(accessToken, thread.id);
  const likedTotalPages = Math.max(1, Math.ceil(engagement.total / likedLimit));
  const msgTotalPages = Math.max(1, Math.ceil(conversations.total / msgLimit));
  const historyTotalPages = Math.max(1, Math.ceil(history.total / historyLimit));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
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
          status={listing.status}
          moderationState={listing.moderationState}
          adminReviewed={listing.adminReviewed}
          messages={messages}
          currentUserId={userId}
        />

        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginTop: 20, background: "var(--surface)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Liked &amp; viewed ({engagement.total})
          </div>
          {engagement.items.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              No liked or viewed activity from logged-in users yet.{listing.viewCount > 0 &&
                ` (${listing.viewCount} total views, including anonymous.)`}
            </p>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                    {["User", "Action", "When"].map((h) => (
                      <th key={h} style={engagementThStyle}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {engagement.items.map((row, i) => (
                    <tr key={`${row.userId}-${row.action}-${i}`} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={engagementTdStyle}>{row.userName ?? row.userPhone ?? row.userEmail ?? "Unknown"}</td>
                      <td style={engagementTdStyle}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: row.action === "liked" ? "var(--green)" : "var(--text-soft)",
                            border: `1px solid ${row.action === "liked" ? "var(--green)" : "var(--border)"}`,
                            borderRadius: 6,
                            padding: "2px 8px",
                          }}
                        >
                          {row.action === "liked" ? "Liked" : "Viewed"}
                        </span>
                      </td>
                      <td style={{ ...engagementTdStyle, whiteSpace: "nowrap" }}>{formatDateTime(row.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            currentPage={likedPage}
            totalPages={likedTotalPages}
            buildHref={(p) => buildPageHref(`/listings/${id}`, sp, p, LIKED_PARAM_NAMES)}
            pageSize={likedLimit}
            sp={sp}
            paramNames={LIKED_PARAM_NAMES}
          />
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginTop: 20, background: "var(--surface)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Messages ({conversations.total})
          </div>
          <ConversationsTable
            listingId={id}
            items={conversations.items}
            ownerId={owner?.id ?? ""}
            ownerName={owner?.name ?? null}
          />
          <Pagination
            currentPage={msgPage}
            totalPages={msgTotalPages}
            buildHref={(p) => buildPageHref(`/listings/${id}`, sp, p, MSG_PARAM_NAMES)}
            pageSize={msgLimit}
            sp={sp}
            paramNames={MSG_PARAM_NAMES}
          />
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginTop: 20, background: "var(--surface)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>History ({history.total})</div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>
            Every edit, moderation action, and status change on this listing — who, what, and when.
          </p>
          {history.items.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>No history recorded yet.</p>
          ) : (
            history.items.map((entry) => <EditHistoryEntry key={entry.id} entry={entry} />)
          )}
          <Pagination
            currentPage={historyPage}
            totalPages={historyTotalPages}
            buildHref={(p) => buildPageHref(`/listings/${id}`, sp, p, HISTORY_PARAM_NAMES)}
            pageSize={historyLimit}
            sp={sp}
            paramNames={HISTORY_PARAM_NAMES}
          />
        </div>
      </div>
    </div>
  );
}

const engagementThStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--muted)",
  whiteSpace: "nowrap",
};
const engagementTdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
