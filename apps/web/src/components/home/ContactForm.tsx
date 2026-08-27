"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCEPTED_ATTACHMENT_MIME_TYPES,
  CONTACT_TOPICS,
  CONTACT_TOPIC_LABELS,
  HONEYPOT_FIELD,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  MAX_ATTACHMENT_BYTES,
  MESSAGE_MAX_LENGTH,
  MESSAGE_MIN_LENGTH,
  TOPICS_WITH_LISTING_URL,
  TOPICS_WITH_PAYMENT_ID,
  type ContactTopic,
} from "@bhavano/types/support";
import { submitSupportTicketAction } from "@/app/actions/support";
import { pushDataLayerEvent } from "@/lib/gtm";

const inputClass =
  "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted";
const labelClass = "block text-[13px] font-bold text-text mb-1.5";
// Same error red the rest of the app uses (see ProfileForm.tsx).
const errorClass = "text-[#b3413a] text-[13px] font-bold m-0";

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContactForm({
  defaultName,
  defaultEmail,
  defaultPhone,
}: {
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
}) {
  const [topic, setTopic] = useState<ContactTopic>("posting");
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [listingUrl, setListingUrl] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Stamped on mount rather than during render (Date.now() is impure, and a re-render would
  // move it) so the server can tell a human apart from a script that posted instantly.
  const mountedAt = useRef<number | null>(null);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  function onFilesPicked(picked: FileList | null) {
    if (!picked) return;
    setError(null);
    const next = [...files];
    for (const file of Array.from(picked)) {
      if (next.length >= MAX_ATTACHMENTS) {
        setError(`You can attach at most ${MAX_ATTACHMENTS} images.`);
        break;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`"${file.name}" is larger than 5 MB.`);
        continue;
      }
      if (next.reduce((sum, f) => sum + f.size, 0) + file.size > MAX_ATTACHMENTS_TOTAL_BYTES) {
        setError("Attachments come to more than 10 MB in total.");
        break;
      }
      next.push(file);
    }
    setFiles(next);
    // Let the same file be re-picked after removal — the input keeps its value otherwise.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
    if (TOPICS_WITH_LISTING_URL.has(topic) && listingUrl.trim()) formData.set("listingUrl", listingUrl.trim());
    if (TOPICS_WITH_PAYMENT_ID.has(topic) && paymentId.trim()) formData.set("paymentId", paymentId.trim());
    formData.set("message", message.trim());
    // A null ref means the mount effect never ran, so there is nothing to measure — send 0,
    // which the server treats as "unknown" and lets through rather than as an instant post.
    formData.set("dwellMs", String(mountedAt.current === null ? 0 : Date.now() - mountedAt.current));
    // Read straight off the form element — the FormData above is built field by field, so the
    // honeypot would otherwise never be sent and the server-side check could never fire.
    const honeypot = new FormData(event.currentTarget).get(HONEYPOT_FIELD);
    if (typeof honeypot === "string" && honeypot) formData.set(HONEYPOT_FIELD, honeypot);
    for (const file of files) formData.append("attachments", file);

    const result = await submitSupportTicketAction(formData);
    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    pushDataLayerEvent("contact_form_submit", { topic });
    setTicketId(result.ticketId);
  }

  if (ticketId) {
    return (
      <div aria-live="polite" className="border border-green rounded-lg p-4">
        <p className="m-0 font-bold text-text">Thanks — we&apos;ve got your message.</p>
        <p className="m-0 mt-2">
          Your reference is <span className="font-bold text-text">{ticketId}</span>. We&apos;ll reply to{" "}
          <span className="font-bold text-text">{email}</span>, usually within a working day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="contact-topic" className={labelClass}>
            What&apos;s this about?
          </label>
          <select
            id="contact-topic"
            className={inputClass}
            value={topic}
            onChange={(e) => setTopic(e.target.value as ContactTopic)}
          >
            {CONTACT_TOPICS.map((t) => (
              <option key={t} value={t}>
                {CONTACT_TOPIC_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contact-name" className={labelClass}>
              Your name
            </label>
            <input id="contact-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="contact-email" className={labelClass}>
              Email we should reply to
            </label>
            <input
              id="contact-email"
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="contact-phone" className={labelClass}>
            Phone <span className="font-medium text-muted">(optional — helps us find your account)</span>
          </label>
          <input
            id="contact-phone"
            inputMode="numeric"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
          />
        </div>

        {TOPICS_WITH_LISTING_URL.has(topic) && (
          <div>
            <label htmlFor="contact-listing" className={labelClass}>
              Link to the listing <span className="font-medium text-muted">(optional)</span>
            </label>
            <input
              id="contact-listing"
              className={inputClass}
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              placeholder="https://bhavano.com/..."
            />
          </div>
        )}

        {TOPICS_WITH_PAYMENT_ID.has(topic) && (
          <div>
            <label htmlFor="contact-payment" className={labelClass}>
              Payment ID <span className="font-medium text-muted">(from your receipt, if you have it)</span>
            </label>
            <input
              id="contact-payment"
              className={inputClass}
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              placeholder="pay_..."
            />
          </div>
        )}

        <div>
          <label htmlFor="contact-message" className={labelClass}>
            What happened?
          </label>
          <textarea
            id="contact-message"
            className={`${inputClass} min-h-[140px] resize-y`}
            value={message}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What you were doing, what you expected, and what happened instead."
            aria-describedby="contact-message-hint"
          />
          <p id="contact-message-hint" className="text-[12px] text-muted m-0 mt-1">
            {message.trim().length < MESSAGE_MIN_LENGTH
              ? `At least ${MESSAGE_MIN_LENGTH} characters.`
              : `${message.length} / ${MESSAGE_MAX_LENGTH}`}
          </p>
        </div>

        <div>
          <label htmlFor="contact-files" className={labelClass}>
            Screenshots <span className="font-medium text-muted">(optional, up to {MAX_ATTACHMENTS})</span>
          </label>
          <input
            id="contact-files"
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_ATTACHMENT_MIME_TYPES.join(",")}
            className="block w-full text-sm text-text-soft"
            onChange={(e) => onFilesPicked(e.target.files)}
          />
          {files.length > 0 && (
            <ul className="list-none m-0 mt-2 p-0 flex flex-col gap-1">
              {files.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-[12.5px] text-text-soft">
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, index) => index !== i))}
                    className="bg-transparent border-0 text-muted cursor-pointer"
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] text-muted m-0 mt-1">
            A screenshot usually explains a bug faster than a description. {formatBytes(totalBytes)} of 10 MB used.
          </p>
        </div>

        {/* Honeypot: hidden from people, irresistible to bots. Not `display:none`, which some
            bots skip — off-screen and untabbable instead. */}
        <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
          <label htmlFor={HONEYPOT_FIELD}>Website</label>
          <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </div>

        {error && (
          <p aria-live="polite" className={errorClass}>
            {error}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="bg-green text-white border-0 rounded-lg px-5 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send message"}
          </button>
        </div>
      </div>
    </form>
  );
}
