"use client";

import { useState } from "react";
import { MESSAGE_MAX_LENGTH, MESSAGE_MIN_LENGTH, type ContactTopic } from "@bhavano/types/support";
import { submitSupportTicketAction } from "@/app/actions/support";
import { Icon } from "./Icon";

const inputClass =
  "w-full bg-surface border border-border rounded-lg px-3 py-2 text-base sm:text-sm text-text placeholder:text-muted";
const labelClass = "block text-[13px] font-bold text-text mb-1.5";
const errorClass = "text-[#b3413a] text-[13px] font-bold m-0";

/**
 * Reports a listing or a conversation's other party, via the same support-ticket pipeline
 * `ContactForm.tsx` posts to (see docs/plans/contact-us-support-form.md) — web's own report
 * dialog, not a second system. Mirrors the mobile app's `ReportSheet.tsx`
 * (docs/plans/mobile-ugc-report-and-block.md), built for Apple App Review's Guideline 1.2
 * requirement that UGC apps have a reporting mechanism, extended here to web for parity.
 *
 * Deliberately not login-gated, unlike mobile: this is the same public, unauthenticated
 * `/support/tickets` endpoint the general Contact Us form already uses, so a logged-out visitor
 * reporting a listing works exactly the way it already does there. `submitSupportTicketAction`
 * stamps `userId` server-side from the session when one exists.
 *
 * Hand-rolled overlay, matching `BoostRecoveryDialog.tsx`'s pattern — there is no shared
 * Modal/Dialog component in this app to reuse.
 */
export function ReportDialog({
  topic,
  context,
  listingUrl,
  defaultName,
  defaultEmail,
  defaultPhone,
  onClose,
}: {
  topic: ContactTopic;
  /** Shown above the message box and prefixed into the ticket's own message field — there is no
   * dedicated "report a message" column, same as every other support topic. */
  context: string;
  listingUrl?: string;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function validate(): string | null {
    if (!name.trim()) return "Please tell us your name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return "Please enter a valid email address.";
    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) return "Phone must be a 10-digit Indian mobile number.";
    if (message.trim().length < MESSAGE_MIN_LENGTH) {
      return `Please describe the issue in at least ${MESSAGE_MIN_LENGTH} characters.`;
    }
    return null;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setPending(true);

    const formData = new FormData();
    formData.set("topic", topic);
    formData.set("name", name.trim());
    formData.set("email", email.trim());
    if (phone.trim()) formData.set("phone", phone.trim());
    if (listingUrl) formData.set("listingUrl", listingUrl);
    formData.set("message", `${context}\n\n${message.trim()}`);

    const result = await submitSupportTicketAction(formData);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <div onClick={onClose} className="fixed inset-0 bg-[var(--modal-scrim)] z-[110] flex items-center justify-center p-5">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-2xl w-[460px] max-w-full p-6 animate-[modalIn_0.2s_ease_both]"
      >
        <div className="flex justify-between items-start mb-1.5">
          <div className="flex items-center gap-2">
            <Icon name="flag" className="text-[#b3413a] text-lg" />
            <div className="font-lora font-bold text-[18px] text-text">Report</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="bg-transparent border-0 text-xl cursor-pointer text-muted">
            <Icon name="close" />
          </button>
        </div>

        {done ? (
          <p className="m-0 mt-3 text-text">
            Report sent — our team will take a look. Thanks for flagging it.
          </p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="mt-3">
            <div className="flex flex-col gap-4">
              <p className="text-[13px] text-muted m-0" title={context}>
                {context}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="report-name" className={labelClass}>
                    Your name
                  </label>
                  <input id="report-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="report-email" className={labelClass}>
                    Email we should reply to
                  </label>
                  <input
                    id="report-email"
                    type="email"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="report-phone" className={labelClass}>
                  Phone <span className="font-medium text-muted">(optional)</span>
                </label>
                <input
                  id="report-phone"
                  inputMode="numeric"
                  className={inputClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                />
              </div>

              <div>
                <label htmlFor="report-message" className={labelClass}>
                  What&apos;s wrong?
                </label>
                <textarea
                  id="report-message"
                  className={`${inputClass} min-h-[100px] resize-y`}
                  value={message}
                  maxLength={MESSAGE_MAX_LENGTH}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the issue — the more detail, the faster we can act."
                />
                <p className="text-[12px] text-muted m-0 mt-1">
                  {message.trim().length < MESSAGE_MIN_LENGTH
                    ? `At least ${MESSAGE_MIN_LENGTH} characters.`
                    : `${message.length} / ${MESSAGE_MAX_LENGTH}`}
                </p>
              </div>

              {error && (
                <p aria-live="polite" className={errorClass}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="bg-green text-white border-0 rounded-lg px-5 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60"
              >
                {pending ? "Sending…" : "Submit report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
