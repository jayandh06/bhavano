"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import type { DeviceType, PageVisitDto, SessionTrailDto } from "@bhavano/types";
import { fetchSessionTrailAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/formatDateTime";

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  mobile_app: "Mobile App",
};

/** The page-visits table body, split out of page.tsx so the row-expand state (which session's
 * trail is open, and the fetched-on-demand trail data itself) can live in a client component
 * without turning the whole page — filters, pagination, the server-rendered row list itself —
 * into one. Multiple sessions can stay expanded at once (not an accordion): opening one doesn't
 * close another, mirroring ConversationsTable's fetch-once-and-cache shape but with
 * `expandedIds: Set<string>` in place of a single `expandedId`. */
export function PageVisitsTable({
  items,
  traffic,
  unclassifiedHref,
  everythingHref,
}: {
  items: PageVisitDto[];
  traffic: string;
  /** Hrefs for the empty state's "try Unclassified/Everything" links — built by the server
   * component via buildTrafficHref, which needs the full current `sp` this client component
   * doesn't otherwise receive. */
  unclassifiedHref: string;
  everythingHref: string;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [trails, setTrails] = useState<Record<string, SessionTrailDto | "loading" | "error">>({});

  async function onToggle(sessionId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
    if (trails[sessionId] !== undefined) return;

    setTrails((prev) => ({ ...prev, [sessionId]: "loading" }));
    const result = await fetchSessionTrailAction(sessionId);
    setTrails((prev) => ({ ...prev, [sessionId]: result.success ? result.trail : "error" }));
  }

  return (
    <tbody>
      {items.map((v) => {
        const isOpen = expandedIds.has(v.sessionId);
        return (
          <Fragment key={v.id}>
            <tr style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(v.createdAt)}</td>
              <td style={tdStyle}>
                <SessionUsers visit={v} />
              </td>
              <td style={tdStyle}>
                <button
                  type="button"
                  onClick={() => onToggle(v.sessionId)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--green)",
                    fontWeight: 700,
                    fontSize: "inherit",
                    textDecoration: "underline",
                  }}
                >
                  {v.pageViewCount}
                </button>
              </td>
              <td style={tdStyle}>{v.deviceType ? DEVICE_TYPE_LABELS[v.deviceType] : dash}</td>
              <td style={tdStyle}>{v.source ?? dash}</td>
              <td style={tdStyle}>{v.medium ?? dash}</td>
              <td style={tdStyle}>{v.campaign ?? dash}</td>
              <td style={tdStyle}>{v.campaignName ?? v.campaignId ?? dash}</td>
              <td style={tdStyle}>{v.adGroupName ?? v.adGroupId ?? dash}</td>
              <td
                style={{ ...tdStyle, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={v.landingPath ?? undefined}
              >
                {v.landingPath ?? dash}
              </td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{v.ip ?? dash}</td>
              <td style={tdStyle}>{v.ipCity ?? dash}</td>
              <td style={tdStyle}>{v.ipRegion ?? dash}</td>
              <td style={tdStyle}>{v.ipCountry ?? dash}</td>
            </tr>
            {isOpen && (
              <tr>
                <td colSpan={14} style={{ padding: 0, borderTop: "1px solid var(--border)" }}>
                  <SessionTrailPanel state={trails[v.sessionId]} sessionId={v.sessionId} />
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
      {/* Inside the table, not instead of it — filtering down to zero used to replace the whole
          thing with a bare paragraph, taking the filter inputs away with it and leaving no way to
          widen the filter that just emptied the page. */}
      {items.length === 0 && (
        <tr style={{ borderTop: "1px solid var(--border)" }}>
          <td colSpan={14} style={{ ...tdStyle, color: "var(--muted)", textAlign: "center", padding: "20px 12px" }}>
            No visits match these filters.
            {/* Expected right after the crawler filter shipped, and confusing without saying
                so: every session recorded before it has no stored User-Agent to judge, so none
                of them can be called human. Only sessions recorded from then on are
                classified. */}
            {traffic === "humans" && (
              <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>
                Only sessions recorded since the crawler filter shipped are classified — older ones have no stored
                User-Agent to judge. Switch Traffic to{" "}
                <Link href={unclassifiedHref} style={{ color: "var(--green)", fontWeight: 700 }}>
                  Unclassified
                </Link>{" "}
                for the history, or{" "}
                <Link href={everythingHref} style={{ color: "var(--green)", fontWeight: 700 }}>
                  Everything
                </Link>
                .
              </div>
            )}
          </td>
        </tr>
      )}
    </tbody>
  );
}

/** The page-view trail for one session, condensed from what the standalone
 * /page-visits/[sessionId] page shows (that route still exists for direct links, this is the
 * same data inline instead of a navigation). */
function SessionTrailPanel({ state, sessionId }: { state: SessionTrailDto | "loading" | "error" | undefined; sessionId: string }) {
  if (state === undefined || state === "loading") {
    return <p style={{ fontSize: 13, color: "var(--muted)", padding: 16, margin: 0 }}>Loading…</p>;
  }
  if (state === "error") {
    return <p style={{ fontSize: 13, color: "var(--danger)", padding: 16, margin: 0 }}>Failed to load this session&apos;s trail.</p>;
  }

  const { visit, pageViews } = state;

  return (
    <div style={{ padding: 16, background: "var(--bg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
          Page trail — {visit.pageViewCount} page{visit.pageViewCount === 1 ? "" : "s"}
        </h3>
        <Link href={`/page-visits/${sessionId}`} style={{ fontSize: 12, color: "var(--green)", fontWeight: 700 }}>
          Open full session page →
        </Link>
      </div>
      {pageViews.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No page views recorded for this session.</p>
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
                  padding: "8px 12px",
                  background: "var(--surface)",
                  fontSize: 13,
                }}
              >
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {i + 1}. {pv.path}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{formatDateTime(pv.createdAt)}</div>
                  {gapMs !== null && <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{formatGap(gapMs)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** "3s later" / "4m later" / "2h later" — same as the standalone session-trail page. */
function formatGap(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s later`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m later`;
  const hours = Math.round(minutes / 60);
  return `${hours}h later`;
}

/**
 * Every account that logged in during this session, not just `Visit.userId` — see
 * `PageVisitDto.sessionLogins`'s own doc comment for why. Two or more is flagged as a likely
 * duplicate account rather than just listed.
 */
function SessionUsers({ visit }: { visit: PageVisitDto }) {
  const logins = visit.sessionLogins;

  if (logins.length === 0) {
    // Still identifiable, just not by a logged-in account: the session id is already this row's
    // own unique key (same href the "Open full session page" link elsewhere in this file uses),
    // shortened to a git-short-hash-style prefix for the table — matches an anonymous visitor
    // across the columns already on screen instead of a plain, useless "anonymous" label.
    if (!visit.userId) {
      return (
        <Link
          href={`/page-visits/${visit.sessionId}`}
          style={{ color: "var(--muted)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
          title={visit.sessionId}
        >
          {visit.sessionId.slice(0, 8)}
        </Link>
      );
    }
    return (
      <Link href={`/users/${visit.userId}`} style={{ color: "var(--green)", fontWeight: 700 }}>
        {visit.userName ?? visit.userPhone ?? visit.userEmail ?? visit.userId}
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {logins.map((l) => (
        <Link key={l.userId} href={`/users/${l.userId}`} style={{ color: "var(--green)", fontWeight: 700, whiteSpace: "nowrap" }}>
          {l.name ?? l.phone ?? l.email ?? l.userId}
          <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 11 }}> · {l.method}</span>
        </Link>
      ))}
      {logins.length > 1 && (
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--gold, #b8860b)", whiteSpace: "nowrap" }}>
          {logins.length} accounts — possible duplicate
        </span>
      )}
    </div>
  );
}

const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
