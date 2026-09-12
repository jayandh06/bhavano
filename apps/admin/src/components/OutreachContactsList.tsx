"use client";

import { useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import type { OutreachContactDto } from "@bhavano/types";
import {
  createListingFromContactBulkAction,
  sendClaimVerificationBulkAction,
  type CreateListingBulkResult,
  type SendClaimVerificationBulkResult,
} from "@/app/actions/outreach";
import { OptOutButton } from "./OptOutButton";
import { formatDate } from "@/lib/formatDateTime";
import { buildSortHref, sortDirectionFor, type SearchParams } from "@/lib/searchParams";

const CONSENT_COLORS: Record<string, string> = {
  none: "var(--muted)",
  implied: "var(--text-soft)",
  explicit: "var(--green)",
  opted_out: "#b3413a",
};

const DIRECT_CREATE_CATEGORIES = new Set(["pg", "coworking"]);

/** Client half of the contacts page — selection state and the two bulk actions need
 * interactivity the server-rendered list above it doesn't. A contact is eligible for exactly one
 * of these at a time (Listing.claimContactId is unique, so `hasListing` and `hasClaimableListing`
 * are mutually exclusive once combined with "already claimed"): "Create listing" for one that's
 * never had one made yet, "Send claim verification" for one that has an unclaimed listing
 * already. Both mirror the eligibility OutreachService itself enforces server-side, so a row
 * offered here never just comes back with a generic failure reason.
 *
 * Table, not cards — matches AdminListingsTable.tsx's own convention (that one's th/tdStyle
 * aren't exported, so these are a local copy of the same values rather than a shared import). */
export function OutreachContactsList({ contacts, sp }: { contacts: OutreachContactDto[]; sp: SearchParams }) {
  const [selectedForCreate, setSelectedForCreate] = useState<Set<string>>(new Set());
  const [selectedForSend, setSelectedForSend] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [createResults, setCreateResults] = useState<CreateListingBulkResult[] | null>(null);
  const [sendResults, setSendResults] = useState<SendClaimVerificationBulkResult[] | null>(null);

  const createEligible = contacts.filter(
    (c) =>
      !c.hasListing &&
      c.consentState !== "opted_out" &&
      DIRECT_CREATE_CATEGORIES.has(c.businessCategory ?? "") &&
      // null (unknown) is left through — this only excludes a business Google has actually
      // told us is closed, never one we simply haven't checked.
      (!c.businessStatus || c.businessStatus === "OPERATIONAL"),
  );
  const sendEligible = contacts.filter((c) => c.hasClaimableListing && c.consentState !== "opted_out");
  const allCreateSelected = createEligible.length > 0 && createEligible.every((c) => selectedForCreate.has(c.id));
  const allSendSelected = sendEligible.length > 0 && sendEligible.every((c) => selectedForSend.has(c.id));

  function toggle(setter: Dispatch<SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onCreate() {
    const chosen = contacts.filter((c) => selectedForCreate.has(c.id));
    if (chosen.length === 0) return;
    setCreating(true);
    setCreateResults(null);
    const outcome = await createListingFromContactBulkAction(chosen.map((c) => ({ id: c.id, name: c.name })));
    setCreating(false);
    setCreateResults(outcome);
    setSelectedForCreate(new Set());
  }

  async function onSend() {
    const chosen = contacts.filter((c) => selectedForSend.has(c.id));
    if (chosen.length === 0) return;
    setSending(true);
    setSendResults(null);
    const outcome = await sendClaimVerificationBulkAction(chosen.map((c) => ({ id: c.id, name: c.name })));
    setSending(false);
    setSendResults(outcome);
    setSelectedForSend(new Set());
  }

  if (contacts.length === 0) {
    return <p style={{ color: "var(--muted)", fontSize: 14 }}>No contacts yet — import some to get started.</p>;
  }

  return (
    <div>
      {createEligible.length > 0 && (
        <div style={toolbarStyle}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={allCreateSelected}
              onChange={() =>
                setSelectedForCreate(allCreateSelected ? new Set() : new Set(createEligible.map((c) => c.id)))
              }
            />
            Select all with no listing yet ({createEligible.length})
          </label>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{selectedForCreate.size} selected</span>
          <button
            type="button"
            onClick={onCreate}
            disabled={creating || selectedForCreate.size === 0}
            style={buttonStyle(creating || selectedForCreate.size === 0)}
          >
            {creating ? "Creating…" : `Create listing (${selectedForCreate.size})`}
          </button>
        </div>
      )}

      {createResults && (
        <div style={resultPanelStyle}>
          <div style={resultHeaderStyle}>
            <strong>
              Created {createResults.filter((r) => r.ok).length} of {createResults.length}
            </strong>
            <button type="button" onClick={() => setCreateResults(null)} style={dismissStyle}>
              Dismiss
            </button>
          </div>
          <ul style={resultListStyle}>
            {createResults.map((r) => (
              <li key={r.contactId} style={{ color: r.ok ? "var(--green)" : "#b3413a" }}>
                {r.name} — {r.ok ? `listing ${r.listingId} created` : r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sendEligible.length > 0 && (
        <div style={toolbarStyle}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={allSendSelected}
              onChange={() => setSelectedForSend(allSendSelected ? new Set() : new Set(sendEligible.map((c) => c.id)))}
            />
            Select all eligible ({sendEligible.length})
          </label>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{selectedForSend.size} selected</span>
          <button
            type="button"
            onClick={onSend}
            disabled={sending || selectedForSend.size === 0}
            style={buttonStyle(sending || selectedForSend.size === 0)}
          >
            {sending ? "Sending…" : `Send claim verification (${selectedForSend.size})`}
          </button>
        </div>
      )}

      {sendResults && (
        <div style={resultPanelStyle}>
          <div style={resultHeaderStyle}>
            <strong>
              Sent to {sendResults.filter((r) => r.sent).length} of {sendResults.length}
            </strong>
            <button type="button" onClick={() => setSendResults(null)} style={dismissStyle}>
              Dismiss
            </button>
          </div>
          <ul style={resultListStyle}>
            {sendResults.map((r) => (
              <li key={r.contactId} style={{ color: r.sent ? "var(--green)" : "#b3413a" }}>
                {r.name} — {r.sent ? `sent via ${r.channels.join(" + ")}` : r.reason ?? "failed"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
              <th style={thStyle} />
              <th style={thStyle}>
                <SortableHeader label="Name" field="name" sp={sp} />
              </th>
              <th style={thStyle}>
                <SortableHeader label="Listing" field="listing" sp={sp} />
              </th>
              <th style={thStyle}>
                <SortableHeader label="Notification" field="notification" sp={sp} />
              </th>
              <th style={thStyle}>
                <SortableHeader label="Consent" field="consent" sp={sp} />
              </th>
              <th style={thStyle}>
                <SortableHeader label="Rating" field="rating" sp={sp} />
              </th>
              <th style={thStyle}>Contact</th>
              <th style={thStyle}>
                <SortableHeader label="City" field="city" sp={sp} /> / category
              </th>
              <th style={thStyle}>Source</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => {
              const creatable = createEligible.includes(contact);
              const sendable = sendEligible.includes(contact);
              return (
                <tr key={contact.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...tdStyle, width: 1 }}>
                    {creatable ? (
                      <input
                        type="checkbox"
                        checked={selectedForCreate.has(contact.id)}
                        onChange={() => toggle(setSelectedForCreate, contact.id)}
                        aria-label={`Select ${contact.name} to create a listing`}
                      />
                    ) : sendable ? (
                      <input
                        type="checkbox"
                        checked={selectedForSend.has(contact.id)}
                        onChange={() => toggle(setSelectedForSend, contact.id)}
                        aria-label={`Select ${contact.name} to send claim verification`}
                      />
                    ) : null}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, maxWidth: 220 }}>{contact.name}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <ListingStatus contact={contact} />
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <NotificationStatus contact={contact} />
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: CONSENT_COLORS[contact.consentState] ?? "var(--muted)",
                        border: `1px solid ${CONSENT_COLORS[contact.consentState] ?? "var(--border)"}`,
                        borderRadius: 6,
                        padding: "2px 8px",
                      }}
                    >
                      {contact.consentState.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <RatingCell contact={contact} />
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    {[contact.phoneE164 ?? contact.phone, contact.email].filter(Boolean).join(" · ") || dash}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    {[contact.cityName, contact.businessCategory].filter(Boolean).join(" · ") || dash}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{contact.source.replace("_", " ")}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Link
                        href={`/outreach/sends?contactId=${contact.id}`}
                        style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}
                      >
                        History
                      </Link>
                      {contact.consentState !== "opted_out" && <OptOutButton contactId={contact.id} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

/** Name/Rating/City column headers — clicking toggles ascending/descending on that field
 * (buildSortHref/sortDirectionFor handle the actual URL logic), replacing what would otherwise
 * be a separate "Sort by" filter control. A full-page navigation like every other filter on this
 * page, not a client-side re-sort — the server is the source of truth for order (and pagination
 * needs it sorted server-side anyway). */
function SortableHeader({ label, field, sp }: { label: string; field: string; sp: SearchParams }) {
  const direction = sortDirectionFor(sp, field);
  return (
    <Link
      href={buildSortHref("/outreach/contacts", sp, field)}
      style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
    >
      {label}
      <span style={{ color: direction ? "var(--text)" : "var(--muted)", fontSize: 10 }}>
        {direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕"}
      </span>
    </Link>
  );
}

/** All three states are real, queryable facts (hasListing/hasClaimableListing), unlike the
 * Notification column next to it — this one isn't hedged. */
function ListingStatus({ contact }: { contact: OutreachContactDto }) {
  if (!contact.hasListing) return dash;
  if (contact.hasClaimableListing) {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold, #b8860b)" }}>Created — unclaimed</span>
    );
  }
  return <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)" }}>Claimed</span>;
}

const CLOSED_STATUSES = new Set(["CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]);
/** Soft warning only — never blocks selection the way businessStatus does. A low rating is a
 * judgement call (a genuinely good PG can have a mediocre Google rating), not a fact like
 * "closed", so this just asks the admin to look twice rather than refusing the action. */
const LOW_RATING_THRESHOLD = 3.5;

function RatingCell({ contact }: { contact: OutreachContactDto }) {
  if (contact.businessStatus && CLOSED_STATUSES.has(contact.businessStatus)) {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: "#b3413a" }}>
        {contact.businessStatus === "CLOSED_PERMANENTLY" ? "Closed permanently" : "Closed temporarily"}
      </span>
    );
  }
  if (contact.googleRating == null) return dash;
  const low = contact.googleRating < LOW_RATING_THRESHOLD;
  return (
    <span style={{ color: low ? "#b3413a" : undefined, fontWeight: low ? 700 : undefined }}>
      ★ {contact.googleRating} ({contact.googleReviewCount ?? 0})
    </span>
  );
}

/** "Success" only appears once claimedViaChannel is set — a claim is the one thing that actually
 * proves a send was delivered and acted on. Short of that, "Sent Nx" is genuinely all that's
 * known: OutreachContact.contactedCount/lastContactedAt is a coarse attempt counter that
 * conflates email and WhatsApp and was recorded even when the *other* channel silently failed.
 * There is deliberately no "Failed" state rendered here — nothing distinguishes a failed send
 * from a delivered-but-ignored one in what's persisted today (see
 * docs/plans/outreach-direct-listing-creation.md). */
function NotificationStatus({ contact }: { contact: OutreachContactDto }) {
  if (contact.claimedViaChannel) {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)" }}>
        Success — via {contact.claimedViaChannel}
      </span>
    );
  }
  if (contact.contactedCount === 0) return <span style={{ color: "var(--muted)" }}>Not sent</span>;
  return (
    <span style={{ color: "var(--muted)" }}>
      Sent {contact.contactedCount}× · {formatDate(contact.lastContactedAt!)}
    </span>
  );
}

const thStyle: CSSProperties = {
  padding: "10px 12px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--muted)",
  whiteSpace: "nowrap",
};
const tdStyle: CSSProperties = { padding: "9px 12px", verticalAlign: "top" };

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  padding: "10px 14px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--surface)",
  flexWrap: "wrap",
};

const checkboxLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};

function buttonStyle(disabled: boolean): CSSProperties {
  return {
    marginLeft: "auto",
    padding: "7px 14px",
    borderRadius: 8,
    border: "none",
    background: "var(--green)",
    color: "var(--on-green, #fff)",
    fontWeight: 700,
    fontSize: 12.5,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

const resultPanelStyle: CSSProperties = {
  marginBottom: 12,
  padding: "10px 14px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--surface)",
  fontSize: 12.5,
};

const resultHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 6,
};

const dismissStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 12,
};

const resultListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
