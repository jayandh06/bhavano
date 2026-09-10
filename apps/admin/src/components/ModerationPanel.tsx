"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingStatus, MessageDto, ModerationState } from "@bhavano/types";
import {
  approveListingAction,
  deleteListingAction,
  flagListingAction,
  sendThreadMessageAction,
  setListingStatusAction,
  setReviewedAction,
} from "@/app/actions/admin";

const LISTING_STATUSES: ListingStatus[] = ["active", "sold", "rented", "deactivated"];

export function ModerationPanel({
  listingId,
  status,
  moderationState,
  adminReviewed,
  messages,
  currentUserId,
}: {
  listingId: string;
  status: ListingStatus;
  moderationState: ModerationState;
  adminReviewed: boolean;
  messages: MessageDto[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [flagMessage, setFlagMessage] = useState("");
  const [showFlagBox, setShowFlagBox] = useState(false);
  const [showDeleteBox, setShowDeleteBox] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [reply, setReply] = useState("");
  const [statusChoice, setStatusChoice] = useState<ListingStatus>(status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `useState(status)` only seeds the initial value — it won't track a `status` prop that
  // changes later on a re-render (e.g. this page revalidating after a completely unrelated
  // action, or another admin's edit). Without this, the dropdown could silently drift from the
  // real current status, and worse, "Update status" could re-enable and let someone submit a
  // stale local choice that reverts a change they never made themselves.
  useEffect(() => {
    setStatusChoice(status);
  }, [status]);

  async function onToggleReviewed() {
    setPending(true);
    setError(null);
    const result = await setReviewedAction(listingId, !adminReviewed);
    setPending(false);
    if (!result.success) setError(result.error);
  }

  async function onFlag() {
    if (!flagMessage.trim()) return;
    setPending(true);
    setError(null);
    const result = await flagListingAction(listingId, flagMessage.trim());
    setPending(false);
    if (result.success) {
      setFlagMessage("");
      setShowFlagBox(false);
    } else {
      setError(result.error);
    }
  }

  async function onApprove() {
    setPending(true);
    setError(null);
    const result = await approveListingAction(listingId);
    setPending(false);
    if (!result.success) setError(result.error);
  }

  async function onSetStatus() {
    if (statusChoice === status) return;
    setPending(true);
    setError(null);
    const result = await setListingStatusAction(listingId, statusChoice);
    setPending(false);
    if (!result.success) setError(result.error);
  }

  async function onDelete() {
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") return;
    setPending(true);
    setError(null);
    const result = await deleteListingAction(listingId);
    if (result.success) {
      router.push("/");
      return; // leave `pending` true — the page is navigating away
    }
    setPending(false);
    setError(result.error);
  }

  async function onSendReply() {
    if (!reply.trim()) return;
    setPending(true);
    setError(null);
    const result = await sendThreadMessageAction(listingId, reply.trim());
    setPending(false);
    if (result.success) setReply("");
    else setError(result.error);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={onToggleReviewed} disabled={pending} style={outlineButtonStyle}>
          {adminReviewed ? "Mark as needing review" : "Mark reviewed"}
        </button>

        {moderationState === "approved" ? (
          <button onClick={() => setShowFlagBox((v) => !v)} disabled={pending} style={dangerButtonStyle}>
            Flag & message owner
          </button>
        ) : (
          <button onClick={onApprove} disabled={pending} style={primaryButtonStyle}>
            Approve — make live again
          </button>
        )}

        <select
          value={statusChoice}
          onChange={(e) => setStatusChoice(e.target.value as ListingStatus)}
          disabled={pending}
          style={selectStyle}
        >
          {LISTING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          onClick={onSetStatus}
          disabled={pending || statusChoice === status}
          style={outlineButtonStyle}
        >
          Update status
        </button>

        <button
          onClick={() => setShowDeleteBox((v) => !v)}
          disabled={pending}
          style={{ ...dangerButtonStyle, marginLeft: "auto" }}
        >
          Delete permanently
        </button>
      </div>

      {showDeleteBox && (
        <div style={{ border: "1.5px solid var(--danger)", borderRadius: 10, padding: 14, background: "var(--surface)" }}>
          <p style={{ fontSize: 13, color: "var(--text-soft)", margin: "0 0 10px" }}>
            Removes the listing, its photos and videos (storage + CDN), all views, favourites,
            conversations, boosts and renewal history. Payments are kept but unlinked. This{" "}
            <strong>cannot be undone</strong> and the owner is not notified. Use{" "}
            <em>Flag &amp; message owner</em> instead for anything fixable.
          </p>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Type DELETE to confirm"
            style={{ ...inputStyle, flex: "unset", width: "100%", marginBottom: 8 }}
          />
          <button
            onClick={onDelete}
            disabled={pending || deleteConfirm.trim().toUpperCase() !== "DELETE"}
            style={{ ...dangerButtonStyle, background: "var(--danger)", color: "#fff", borderColor: "var(--danger)", opacity: pending || deleteConfirm.trim().toUpperCase() !== "DELETE" ? 0.5 : 1 }}
          >
            {pending ? "Deleting…" : "Permanently delete this listing"}
          </button>
        </div>
      )}

      {showFlagBox && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, background: "var(--surface)" }}>
          <textarea
            value={flagMessage}
            onChange={(e) => setFlagMessage(e.target.value)}
            placeholder="Explain what's wrong with this listing — the owner will see this message and can fix and resubmit."
            rows={3}
            style={textareaStyle}
          />
          <button onClick={onFlag} disabled={pending || !flagMessage.trim()} style={{ ...dangerButtonStyle, marginTop: 8 }}>
            {pending ? "Sending…" : "Take offline & send"}
          </button>
        </div>
      )}

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Conversation with owner</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {messages.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>No messages yet.</p>}
          {messages.map((m) => {
            const isMine = m.senderId === currentUserId;
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  background: isMine ? "var(--green)" : "var(--surface-alt)",
                  color: isMine ? "var(--on-green)" : "var(--text)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 13.5,
                  maxWidth: "80%",
                }}
              >
                {m.body}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Send a message to the owner…"
            style={inputStyle}
          />
          <button onClick={onSendReply} disabled={pending || !reply.trim()} style={primaryButtonStyle}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const selectStyle: React.CSSProperties = {
  border: "1.5px solid var(--border)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
};

const outlineButtonStyle: React.CSSProperties = {
  background: "var(--surface)",
  color: "var(--text)",
  border: "1.5px solid var(--border)",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  background: "var(--surface)",
  color: "var(--danger)",
  border: "1.5px solid var(--danger)",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "10px 12px",
  fontSize: 13.5,
  outline: "none",
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  resize: "vertical",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "10px 12px",
  fontSize: 13.5,
  outline: "none",
  background: "var(--surface)",
  color: "var(--text)",
};
