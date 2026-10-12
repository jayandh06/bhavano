import Link from "next/link";
import { notFound } from "next/navigation";
import type { ActivityEventDto, AdminUserListingDto, DeviceType, VisitDto } from "@bhavano/types";
import { postedByLabel } from "@bhavano/types/sellerType";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchUserActivity } from "@/lib/bff";
import { formatDate, formatDateTime } from "@/lib/formatDateTime";
import { DeleteUserPanel } from "@/components/DeleteUserPanel";
import { AgentStatusPanel } from "@/components/AgentStatusPanel";

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  mobile_app: "Mobile App",
};

const EVENT_ICONS: Record<ActivityEventDto["type"], string> = {
  login: "🔑",
  listing_posted: "📝",
  listing_updated: "✏️",
  message_sent: "💬",
  favourite_added: "♡",
  listing_viewed: "👁",
};

/** Renders a visit/acquisition source as e.g. "google · cpc · summer_sale" or "facebook.com ·
 * referral" or plain "direct" — trailing parts are only shown when present. */
function formatSource(source: string | null, medium?: string | null, campaign?: string | null): string {
  return [source ?? "unknown", medium, campaign].filter(Boolean).join(" · ");
}

/** Null when the GeoIP lookup found nothing at all — distinct from a landingPath-style blank,
 * since "no guess" should render no line rather than an empty parenthetical. */
function formatIpLocation(city: string | null, region: string | null, country: string | null): string | null {
  const parts = [city, region, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export default async function UserActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { accessToken } = await requireAdmin();
  const { id } = await params;

  const activity = await fetchUserActivity(accessToken, id).catch(() => null);
  if (!activity) notFound();

  const { user, ownedListings, events, visits } = activity;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/users" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to users
        </Link>

        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20, background: "var(--surface)" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{user.name ?? "Unnamed user"}</h1>
          <div style={{ fontSize: 13.5, color: "var(--text-soft)", marginBottom: 4 }}>
            {[user.phone, user.email].filter(Boolean).join(" · ") || "No contact info"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {user.cityName ? `${user.cityName} · ` : ""}
            {user.role === "admin" ? "Admin" : "User"} · joined {formatDate(user.createdAt)}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
            Posts as: {postedByLabel(user.sellerType, user.agencyName) ?? "not answered yet"}
            {user.reraNumber && ` · RERA ${user.reraNumber}${user.reraVerifiedAt ? " ✓ verified" : ""}`}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
            Found via:{" "}
            {user.acquisitionSource
              ? formatSource(user.acquisitionSource, user.acquisitionMedium, user.acquisitionCampaign)
              : "unknown (predates acquisition tracking)"}
          </div>
        </div>

        <AgentStatusPanel
          userId={id}
          isAgent={user.sellerType === "agent"}
          reraNumber={user.reraNumber}
          reraVerifiedAt={user.reraVerifiedAt}
          agentProUntil={user.agentProUntil}
          proActive={user.agentProUntil !== null && new Date(user.agentProUntil) > new Date()}
        />

        <DeleteUserPanel userId={id} canDelete={user.role !== "admin"} />

        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 12px" }}>
          Listings ({ownedListings.length})
        </h2>
        {ownedListings.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>This user has not added any listings.</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                  {["Listing", "Category", "Type", "Location", "Price", "Listing status", "Publish state", "Moderation", "Views", "Created", "Expires"].map((label) => (
                    <th key={label} style={thStyle}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ownedListings.map((listing: AdminUserListingDto) => (
                  <tr key={listing.id} style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                    <td style={{ ...tdStyle, minWidth: 220 }}>
                      <a
                        href={`/listings/${encodeURIComponent(listing.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--green)", fontWeight: 700 }}
                      >
                        {listing.title}
                      </a>
                    </td>
                    <td style={tdStyle}>{listing.category}</td>
                    <td style={tdStyle}>{listing.transactionType}</td>
                    <td style={tdStyle}>{listing.area}, {listing.cityName}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(listing.price)}
                    </td>
                    <td style={tdStyle}>{listing.status}</td>
                    <td style={tdStyle}>{listing.publishState}</td>
                    <td style={tdStyle}>{listing.moderationState}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{listing.viewCount.toLocaleString()}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(listing.createdAt)}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDate(listing.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Recent activity</h2>
        {events.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No recorded activity yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {events.map((event, i) => (
              <div
                key={`${event.type}-${event.refId}-${i}`}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  border: "1px solid var(--border)",
                  borderRadius: 9,
                  padding: "10px 14px",
                  background: "var(--surface)",
                }}
              >
                <span style={{ fontSize: 15 }}>{EVENT_ICONS[event.type]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5 }}>{event.summary}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                    {formatDateTime(event.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 12px" }}>Visit history</h2>
        {visits.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No recorded visits yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visits.map((visit: VisitDto) => {
              const ipLocation = formatIpLocation(visit.ipCity, visit.ipRegion, visit.ipCountry);
              return (
              <div
                key={visit.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  border: "1px solid var(--border)",
                  borderRadius: 9,
                  padding: "10px 14px",
                  background: "var(--surface)",
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5 }}>
                    {formatSource(visit.source, visit.medium, visit.campaign)}
                    {visit.deviceType && ` · ${DEVICE_TYPE_LABELS[visit.deviceType]}`}
                  </div>
                  {visit.landingPath && (
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                      Landed on {visit.landingPath}
                    </div>
                  )}
                  {ipLocation && (
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                      {ipLocation} (from IP, approximate)
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{formatDateTime(visit.createdAt)}</div>
                  <Link
                    href={`/page-visits/${visit.sessionId}`}
                    style={{ fontSize: 11.5, color: "var(--green)", fontWeight: 700 }}
                  >
                    {visit.pageViewCount} page{visit.pageViewCount === 1 ? "" : "s"} →
                  </Link>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--muted)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "9px 12px",
  verticalAlign: "top",
};
