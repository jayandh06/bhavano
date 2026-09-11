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
 * offered here never just comes back with a generic failure reason. */
export function OutreachContactsList({ contacts }: { contacts: OutreachContactDto[] }) {
  const [selectedForCreate, setSelectedForCreate] = useState<Set<string>>(new Set());
  const [selectedForSend, setSelectedForSend] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [createResults, setCreateResults] = useState<CreateListingBulkResult[] | null>(null);
  const [sendResults, setSendResults] = useState<SendClaimVerificationBulkResult[] | null>(null);

  const createEligible = contacts.filter(
    (c) => !c.hasListing && c.consentState !== "opted_out" && DIRECT_CREATE_CATEGORIES.has(c.businessCategory ?? ""),
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

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {contacts.map((contact) => {
          const creatable = createEligible.includes(contact);
          const sendable = sendEligible.includes(contact);
          return (
            <div
              key={contact.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 14,
                background: "var(--surface)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
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
                ) : (
                  // Reserves the same width as a real checkbox — keeps names aligned in a mixed
                  // list of selectable/non-selectable rows instead of a ragged left edge.
                  <span style={{ width: 13, flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{contact.name}</span>
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
                    {contact.googleRating != null && (
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        ★ {contact.googleRating} ({contact.googleReviewCount ?? 0})
                      </span>
                    )}
                    {contact.hasClaimableListing && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold, #b8860b)" }}>
                        Unclaimed listing
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>
                    {[contact.phoneE164 ?? contact.phone, contact.email, contact.cityName, contact.businessCategory]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                    {contact.contactedCount === 0
                      ? "Never contacted"
                      : `Contacted ${contact.contactedCount}× · last ${formatDate(contact.lastContactedAt!)}`}
                    {" · via "}
                    {contact.source.replace("_", " ")}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Link
                  href={`/outreach/sends?contactId=${contact.id}`}
                  style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}
                >
                  History
                </Link>
                {contact.consentState !== "opted_out" && <OptOutButton contactId={contact.id} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
