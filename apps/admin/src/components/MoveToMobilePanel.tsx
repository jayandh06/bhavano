"use client";

import { useState } from "react";
import type { MoveToMobileAudienceDto } from "@bhavano/types/loginSettings";
import { sendMoveToMobileAction } from "@/app/actions/admin";

const cardStyle = { border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)", marginTop: 20 } as const;

/** The in-app "add your mobile number" message. It goes into an ad's message thread from "Bhavano Admin" (with a push if the owner has the app), so it can only
 * reach accounts that own an ad; everyone else gets the prompt on their next visit (the setting above). Once per person, and it asks before sending. */
export function MoveToMobilePanel({ audience }: { audience: MoveToMobileAudienceDto }) {
  const [deadline, setDeadline] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const toSend = audience.ownersWithAds - audience.alreadyMessaged;

  async function onSend() {
    if (!window.confirm(`Send the in-app message to ${toSend} owner${toSend === 1 ? "" : "s"} now? Each person gets it once.`)) return;
    setSending(true);
    setMessage(null);
    const res = await sendMoveToMobileAction(deadline.trim() || undefined);
    setSending(false);
    setMessage(
      res.success
        ? { type: "success", text: `Sent to ${res.result.sent}${res.result.skipped ? `, ${res.result.skipped} failed (see the server log)` : ""}.` }
        : { type: "error", text: res.error },
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>In-app message: add your mobile number</div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px", maxWidth: 680 }}>
        {audience.emailOnly} account{audience.emailOnly === 1 ? " has" : "s have"} no mobile number. {audience.ownersWithAds} of them own a live ad, so a message
        can reach them in their inbox ({audience.alreadyMessaged} already sent, {toSend} still to send). The others see the prompt on their next visit.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Deadline to mention (optional, e.g. &ldquo;10 November&rdquo;)</span>
        <input
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          maxLength={40}
          style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "9px 10px", fontSize: 13.5, background: "var(--surface)", color: "var(--text)", maxWidth: 260 }}
        />
      </label>
      <p style={{ fontSize: 12.5, color: "var(--text-soft)", margin: "0 0 12px", maxWidth: 680 }}>
        &ldquo;Bhavano is moving to mobile-number sign-in, and Google sign-in will end{deadline.trim() ? ` by ${deadline.trim()}` : " soon"}. Please add and verify your
        mobile number so you keep your account and your ads: open your profile and choose Add phone number. It takes under a minute.&rdquo;
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onSend}
          disabled={sending || toSend === 0}
          style={{
            background: "var(--green)",
            color: "var(--on-green)",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: sending || toSend === 0 ? "default" : "pointer",
            opacity: sending || toSend === 0 ? 0.6 : 1,
          }}
        >
          {sending ? "Sending…" : `Send to ${toSend} owner${toSend === 1 ? "" : "s"}`}
        </button>
        {message && <span style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "var(--danger)" }}>{message.text}</span>}
      </div>
    </div>
  );
}
