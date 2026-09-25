"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUserAction } from "@/app/actions/users";

/** Permanent-removal control on the admin user page. Deletes every listing the user owns (with
 * photo/video storage cleanup) and anonymises the account. Two-step: expand, then type DELETE. */
export function DeleteUserPanel({
  userId,
  canDelete = true,
}: {
  userId: string;
  /** False for admin accounts — BFF refuses those anyway. */
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deep-link from the Users list (`/users/[id]#delete`) opens the confirm panel immediately.
  useEffect(() => {
    if (!canDelete) return;
    if (typeof window !== "undefined" && window.location.hash === "#delete") {
      setOpen(true);
    }
  }, [canDelete]);

  const armed = confirm.trim().toUpperCase() === "DELETE";

  if (!canDelete) {
    return (
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
        Admin accounts cannot be deleted from here.
      </p>
    );
  }

  async function onDelete() {
    if (!armed) return;
    setPending(true);
    setError(null);
    const result = await deleteUserAction(userId);
    if (result.success) {
      router.push("/users");
      return; // leave `pending` true while the page navigates away
    }
    setPending(false);
    setError(result.error);
  }

  return (
    <div id="delete" style={{ marginBottom: 20 }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={dangerButtonStyle}>
          Delete user permanently
        </button>
      ) : (
        <div style={{ border: "1.5px solid var(--danger)", borderRadius: 10, padding: 14, background: "var(--surface)" }}>
          <p style={{ fontSize: 13, color: "var(--text-soft)", margin: "0 0 10px" }}>
            Deletes <strong>every listing this user owns</strong> — including their photos and
            videos from storage and the CDN — plus their saved searches and push tokens, and
            scrubs their name, email and phone. The account row is kept (anonymised) because
            payment and conversation records reference it. This <strong>cannot be undone</strong>.
            Admin accounts are refused.
          </p>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type DELETE to confirm"
            style={inputStyle}
            autoFocus
          />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              onClick={onDelete}
              disabled={pending || !armed}
              style={{ ...dangerButtonStyle, background: "var(--danger)", color: "#fff", opacity: pending || !armed ? 0.5 : 1 }}
            >
              {pending ? "Deleting…" : "Permanently delete this user"}
            </button>
            <button onClick={() => setOpen(false)} disabled={pending} style={outlineButtonStyle}>
              Cancel
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

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

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "10px 12px",
  fontSize: 13.5,
  outline: "none",
  background: "var(--surface)",
  color: "var(--text)",
};
