import Link from "next/link";
import { notFound } from "next/navigation";
import type { DeviceType } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchSessionTrail } from "@/lib/bff";
import { formatDateTime } from "@/lib/formatDateTime";

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  mobile_app: "Mobile App",
};

/** Renders a visit/acquisition source the same way the user-activity page does — e.g.
 * "google · cpc · summer_sale" or "direct". */
function formatSource(source: string | null, medium?: string | null, campaign?: string | null): string {
  return [source ?? "unknown", medium, campaign].filter(Boolean).join(" · ");
}

function formatIpLocation(city: string | null, region: string | null, country: string | null): string | null {
  const parts = [city, region, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** "3s later" / "4m later" / "2h later" — the gap since the previous page view, so a long pause
 * (reading a listing, stepping away) is visually distinct from rapid clicking. */
function formatGap(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s later`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m later`;
  const hours = Math.round(minutes / 60);
  return `${hours}h later`;
}

export default async function SessionTrailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { accessToken } = await requireAdmin();
  const { sessionId } = await params;

  const trail = await fetchSessionTrail(accessToken, sessionId).catch(() => null);
  if (!trail) notFound();

  const { visit, pageViews } = trail;
  const ipLocation = formatIpLocation(visit.ipCity, visit.ipRegion, visit.ipCountry);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/page-visits" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to Page visits
        </Link>

        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 24, background: "var(--surface)" }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
            {visit.userId ? (
              <Link href={`/users/${visit.userId}`} style={{ color: "var(--green)" }}>
                {visit.userName ?? visit.userPhone ?? visit.userEmail ?? visit.userId}
              </Link>
            ) : (
              "Anonymous session"
            )}
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--text-soft)", marginBottom: 4 }}>
            {formatSource(visit.source, visit.medium, visit.campaign)}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Started {formatDateTime(visit.createdAt)}
            {visit.deviceType ? ` · ${DEVICE_TYPE_LABELS[visit.deviceType]}` : ""}
            {ipLocation ? ` · ${ipLocation} (from IP, approximate)` : ""}
            {visit.ip ? ` · ${visit.ip}` : ""}
          </div>
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
          Page trail — {visit.pageViewCount} page{visit.pageViewCount === 1 ? "" : "s"}
        </h2>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.6 }}>
          Every real navigation this session made, oldest first. A navigation to an already-prefetched
          (cached) link never reaches the server, so this is a best-effort trail, not a guaranteed-complete one.
          {pageViews.length < visit.pageViewCount && ` Showing the first ${pageViews.length.toLocaleString()}.`}
        </p>

        {pageViews.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No page views recorded for this session.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pageViews.map((pv, i) => {
              const prev = i > 0 ? pageViews[i - 1] : null;
              const gapMs = prev ? new Date(pv.createdAt).getTime() - new Date(prev.createdAt).getTime() : null;
              return (
                <div
                  key={`${pv.path}-${pv.createdAt}-${i}`}
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
                  <div style={{ fontSize: 13.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {i + 1}. {pv.path}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{formatDateTime(pv.createdAt)}</div>
                    {gapMs !== null && (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{formatGap(gapMs)}</div>
                    )}
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
