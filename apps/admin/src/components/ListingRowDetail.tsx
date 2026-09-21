"use client";

import type { ListingDetailDto } from "@bhavano/types";

/** The expanded panel for one row of AdminListingsTable — description, photos, video status,
 * attributes, renewal history, and contact-reveal info: exactly the fields the list query used to
 * fetch for every row on every page load (see AdminListingRowDto's own doc comment) before this
 * moved to an on-demand fetch of the full ListingDetailDto instead. Not a condensed copy of
 * /listings/[id]'s own layout — that page also fetches owner/engagement/edit-history/
 * conversations/the moderation thread, none of which belongs in a quick inline glance, so this is
 * a smaller, purpose-built panel over just what `GET /listings/:id` itself returns. */
export function ListingRowDetail({ state }: { state: ListingDetailDto | "loading" | "error" | undefined }) {
  if (state === undefined || state === "loading") {
    return <p style={{ fontSize: 13, color: "var(--muted)", padding: 16, margin: 0 }}>Loading…</p>;
  }
  if (state === "error") {
    return <p style={{ fontSize: 13, color: "var(--danger)", padding: 16, margin: 0 }}>Failed to load this listing&apos;s detail.</p>;
  }

  const listing = state;

  return (
    <div style={{ padding: 16, background: "var(--bg)", display: "flex", flexDirection: "column", gap: 14 }}>
      {listing.photosFull.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {listing.photosFull.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- a quick admin thumbnail strip, not a page needing Next's image optimizer
            <img
              key={url}
              src={url}
              alt={`${listing.title} photo ${i + 1}`}
              style={{ height: 90, width: 120, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }}
            />
          ))}
        </div>
      )}

      {listing.videos.length > 0 && (
        <Section label="Videos">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {listing.videos.map((v) => (
              <span key={v.id} style={pillStyle}>
                #{v.videoNo} · {v.status} · {v.durationSec}s
              </span>
            ))}
          </div>
        </Section>
      )}

      {listing.description && (
        <Section label="Description">
          <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{listing.description}</p>
        </Section>
      )}

      {Object.keys(listing.attributes).length > 0 && (
        <Section label="Attributes">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6 }}>
            {Object.entries(listing.attributes).map(([key, value]) => (
              <div key={key} style={{ fontSize: 12.5 }}>
                <span style={{ color: "var(--muted)" }}>{key}: </span>
                <span style={{ fontWeight: 600 }}>{String(value)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section label={`Renewals (${listing.renewCount})`}>
        {listing.renewalHistory && listing.renewalHistory.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {listing.renewalHistory.map((r, i) => (
              <div key={`${r.renewedAt}-${i}`} style={{ fontSize: 12.5, color: "var(--text-soft)" }}>
                {formatShort(r.renewedAt)} — extended {formatShort(r.from)} → {formatShort(r.to)}
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Never renewed.</span>
        )}
      </Section>

      <Section label="Contact">
        {listing.contactRevealed ? (
          <div style={{ fontSize: 12.5 }}>
            {listing.ownerPhone && <div>{listing.ownerPhone}</div>}
            {listing.ownerEmail && <div>{listing.ownerEmail}</div>}
            {!listing.ownerPhone && !listing.ownerEmail && <span style={{ color: "var(--muted)" }}>No phone/email on file.</span>}
          </div>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Not revealed to this admin session yet.</span>
        )}
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const pillStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: 20,
  background: "var(--surface-alt)",
  border: "1px solid var(--border)",
  color: "var(--text-soft)",
};
