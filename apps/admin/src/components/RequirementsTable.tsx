"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminRequirementDto, RequirementStatus } from "@bhavano/types";
import { updateRequirementAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/formatDateTime";

const STATUS_LABELS: Record<RequirementStatus, string> = {
  open: "Open",
  working: "Working",
  closed: "Closed",
};

const STATUS_COLORS: Record<RequirementStatus, string> = {
  open: "var(--danger)",
  working: "var(--gold)",
  closed: "var(--muted)",
};

/** The unmet-demand queue — and, at current volume, the matching engine itself.
 *
 * Every row is someone who searched and found nothing. The job is to read it, look for something
 * in the catalogue that is close enough, call them, or point outreach at owners in that area —
 * see docs/plans/property-requirements-demand-side.md. That is deliberately manual: with 1-3
 * captures a day a person can work all of them, and doing so is also how inventory gets recruited
 * into the areas that have none.
 *
 * The seeker's contact details are shown in full here, unlike anywhere on the public site. This
 * is the admin surface for the person who will actually make the call; the plan's paid,
 * consent-gated contact path governs the eventual *public* feed, not this.
 */
export function RequirementsTable({ items }: { items: AdminRequirementDto[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>Nothing here — no captured requirements match this filter.</p>
      )}
      {items.map((item) => (
        <RequirementCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function RequirementCard({ item }: { item: AdminRequirementDto }) {
  const [status, setStatus] = useState<RequirementStatus>(item.status);
  const [note, setNote] = useState(item.adminNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(next: { status?: RequirementStatus; adminNote?: string }) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateRequirementAction(item.id, next);
    setSaving(false);
    if (result.success) setSaved(true);
    else setError(result.error);
  }

  const budget =
    item.minPrice !== undefined || item.maxPrice !== undefined
      ? `₹${(item.minPrice ?? 0).toLocaleString("en-IN")} – ${item.maxPrice ? `₹${item.maxPrice.toLocaleString("en-IN")}` : "any"}`
      : null;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{item.searchLabel}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
            {[
              item.areaName ?? item.cityName,
              item.bedrooms ? `${item.bedrooms} BHK` : null,
              budget,
              item.category,
              item.transactionType,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12 }}>
          <span
            style={{
              display: "inline-block",
              fontWeight: 700,
              fontSize: 11,
              color: STATUS_COLORS[status],
              border: `1px solid ${STATUS_COLORS[status]}`,
              borderRadius: 6,
              padding: "2px 8px",
            }}
          >
            {STATUS_LABELS[status]}
          </span>
          <div style={{ color: "var(--muted)", marginTop: 6 }}>{formatDateTime(item.createdAt)}</div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          fontSize: 12.5,
        }}
      >
        <div>
          <span style={{ color: "var(--muted)" }}>Seeker: </span>
          <Link href={`/users/${item.seekerId}`} style={{ fontWeight: 700 }}>
            {item.seekerName ?? "(no name)"}
          </Link>
        </div>
        {item.seekerPhone && (
          <div>
            <span style={{ color: "var(--muted)" }}>Phone: </span>
            <a href={`tel:${item.seekerPhone}`} style={{ fontWeight: 700 }}>
              {item.seekerPhone}
            </a>
          </div>
        )}
        {item.seekerEmail && (
          <div>
            <span style={{ color: "var(--muted)" }}>Email: </span>
            <a href={`mailto:${item.seekerEmail}`} style={{ fontWeight: 700 }}>
              {item.seekerEmail}
            </a>
          </div>
        )}
        <div>
          {/* Whether anything will reach them on its own. "No alert" means the whole follow-up is
              this screen — worth seeing before deciding what to work first. */}
          <span style={{ color: "var(--muted)" }}>Alert: </span>
          <strong style={{ color: item.hasAlert ? "var(--green)" : "var(--danger)" }}>
            {item.hasAlert ? "yes" : "no — manual only"}
          </strong>
        </div>
        <div>
          {/* Whether their number may go to an owner at all. Worth seeing right next to the phone
              number above it, because it is the difference between "call them" and "we call
              them". */}
          <span style={{ color: "var(--muted)" }}>Owners may contact: </span>
          <strong style={{ color: item.contactConsent ? "var(--green)" : "var(--danger)" }}>
            {item.contactConsent ? "yes — agreed" : "no — Bhavano only"}
          </strong>
        </div>
        {item.landingPath && (
          <div>
            <span style={{ color: "var(--muted)" }}>Searched: </span>
            <a href={`https://www.bhavano.com${item.landingPath}`} target="_blank" rel="noopener noreferrer">
              {item.landingPath}
            </a>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>Status</span>
          <select
            value={status}
            onChange={(e) => {
              const next = e.target.value as RequirementStatus;
              setStatus(next);
              void save({ status: next });
            }}
            style={selectStyle}
          >
            {(Object.keys(STATUS_LABELS) as RequirementStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 240 }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>
            What was done — who was called, what was suggested
          </span>
          <input value={note} onChange={(e) => setNote(e.target.value)} style={{ ...selectStyle, width: "100%" }} />
        </label>
        <button onClick={() => void save({ adminNote: note })} disabled={saving} style={buttonStyle}>
          {saving ? "Saving…" : "Save note"}
        </button>
        {saved && <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 700 }}>Saved</span>}
        {error && <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 9px",
  fontSize: 12.5,
  background: "var(--surface)",
  color: "var(--text)",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};
