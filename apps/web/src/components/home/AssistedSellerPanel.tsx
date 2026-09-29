"use client";

import { useRef, useState } from "react";
import type { ListingOwnerDto, SellerType } from "@bhavano/types";
import { searchUsersAsAdminAction } from "@/app/actions/listings";

export interface AssistedSeller {
  enabled: boolean;
  name: string;
  phone: string;
  sellerType: SellerType | null;
}

export const EMPTY_ASSISTED_SELLER: AssistedSeller = { enabled: false, name: "", phone: "", sellerType: null };

/** The last 10 digits of an Indian mobile typed with or without +91 / 0 / spaces, or null. */
export function assistedSellerPhoneDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

/** What's still missing before an assisted ad can be posted, or null when it's complete. */
export function assistedSellerProblem(seller: AssistedSeller): string | null {
  if (seller.name.trim().length < 2) return "Enter the seller's name.";
  if (!assistedSellerPhoneDigits(seller.phone)) return "Enter the seller's 10-digit mobile number.";
  if (!seller.sellerType) return "Choose whether the seller is the owner or an agent.";
  return null;
}

const toggleClass = (active: boolean) =>
  `text-center border-[1.5px] rounded-[10px] px-4 py-2 text-sm font-bold text-text cursor-pointer ${
    active ? "border-green bg-surface-alt" : "border-border bg-surface"
  }`;
const inputClass =
  "w-full border border-border rounded-[10px] px-3 py-2 text-sm bg-surface text-text focus:outline-none focus:border-green";

/** Admin-only: post this ad for a seller who asked for help. The ad is saved hidden and the seller
 * publishes it by signing in with this phone. See docs/plans/admin-assisted-posting.md. */
export function AssistedSellerPanel({
  value,
  onChange,
}: {
  value: AssistedSeller;
  onChange: (next: AssistedSeller) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ListingOwnerDto[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(next: string) {
    setQuery(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void searchUsersAsAdminAction(next).then(setResults);
    }, 300);
  }

  function pick(user: ListingOwnerDto) {
    onChange({ ...value, name: user.name ?? value.name, phone: user.phone ?? value.phone });
    setQuery("");
    setResults([]);
  }

  return (
    <div className="mb-6 rounded-xl border-2 border-dashed border-[color:var(--gold)] bg-[color:var(--gold)]/5 px-4 py-3.5">
      <label className="flex items-center gap-2 text-sm font-bold text-text cursor-pointer">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        Posting for someone else (admin)
      </label>
      {value.enabled && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="m-0 text-[12px] text-text-soft">
            The ad stays hidden until the seller signs in with this phone and presses Publish. You get a
            link to send them after posting. Nothing is saved as a draft on this device.
          </p>
          <div className="relative">
            <input
              className={inputClass}
              placeholder="Pick an existing user (name, phone or email)"
              value={query}
              onChange={(e) => search(e.target.value)}
            />
            {results.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 m-0 p-0 list-none rounded-[10px] border border-border bg-surface shadow-lg max-h-60 overflow-auto">
                {results.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => pick(user)}
                      disabled={!user.phone}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface-alt disabled:opacity-50 cursor-pointer bg-transparent border-0"
                    >
                      <span className="font-bold">{user.name ?? "Unnamed"}</span>
                      <span className="text-muted"> · {user.phone ?? "no phone, can't claim"}</span>
                      {user.email && <span className="text-muted"> · {user.email}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="Seller's name"
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Seller's mobile (10 digits)"
              inputMode="tel"
              value={value.phone}
              onChange={(e) => onChange({ ...value, phone: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-bold text-text mr-1">The seller is</span>
            {(
              [
                ["owner", "Owner"],
                ["agent", "Agent / broker"],
              ] as const
            ).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange({ ...value, sellerType: type })}
                className={toggleClass(value.sellerType === type)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** "Send this to the seller": the claim link, a copy button and a pre-filled WhatsApp message. */
export function AssistedClaimLinkPanel({
  claimUrl,
  sellerName,
  sellerPhone,
  title,
}: {
  claimUrl: string;
  sellerName: string;
  sellerPhone: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const firstName = sellerName.trim().split(/\s+/)[0] ?? "";
  const message =
    `Hi ${firstName}, we've prepared your Bhavano ad "${title}". ` +
    `Open this link, sign in with this number, check the details and press Publish: ${claimUrl}`;
  const digits = assistedSellerPhoneDigits(sellerPhone);
  const whatsappHref = `https://wa.me/${digits ? `91${digits}` : ""}?text=${encodeURIComponent(message)}`;

  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3">
      <p className="m-0 text-[13px] text-text-soft">
        Send this link to {sellerName.trim() || "the seller"}. The ad goes live when they sign in with their
        phone and press Publish. Unclaimed ads are deleted after 14 days.
      </p>
      <code className="block break-all rounded-lg bg-surface-alt px-3 py-2 text-[12.5px]">{claimUrl}</code>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(claimUrl).then(() => setCopied(true));
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-bold text-text cursor-pointer"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-green px-3 py-2 text-[13px] font-bold text-[color:var(--on-green)] no-underline"
        >
          Share on WhatsApp
        </a>
      </div>
    </div>
  );
}
