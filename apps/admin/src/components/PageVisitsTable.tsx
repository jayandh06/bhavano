"use client";

import Link from "next/link";
import type { DeviceType, PageVisitDto } from "@bhavano/types";
import { formatDateTime } from "@/lib/formatDateTime";

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  mobile_app: "Mobile App",
};

/** The page-visits table body, split out of page.tsx so this stays a client component (needed for
 * the "Pages" column's link) without turning the whole page — filters, pagination, the server-
 * rendered row list itself — into one. */
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
  return (
    <tbody>
      {items.map((v) => (
        <tr key={v.id} style={{ borderTop: "1px solid var(--border)" }}>
          <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(v.createdAt)}</td>
          <td style={tdStyle}>
            <SessionUsers visit={v} />
          </td>
          <td style={tdStyle}>
            {/* A real link to the full session page, opened in a new tab on a plain click — not
               just a <button> toggling an inline panel, which had no href for ctrl/cmd/middle-
               click or "open in new tab" to act on. */}
            <Link
              href={`/page-visits/${v.sessionId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--green)",
                fontWeight: 700,
                fontSize: "inherit",
                textDecoration: "underline",
              }}
            >
              {v.pageViewCount}
            </Link>
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
      ))}
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
