"use client";

import type { ListingStatus, TransactionType } from "@bhavano/types";
import { leavingActiveNotice, statusOptionsFor } from "@bhavano/types/listingStatusInfo";

/**
 * The ad status choice on the edit screen: one card per option saying when to pick it and what
 * happens, with a summary underneath once the owner picks something that hides the ad. Replaces a
 * bare dropdown whose "Sold" / "Rented" said nothing about the consequences. The copy lives in
 * `@bhavano/types/listingStatusInfo` (shared with the mobile app); see
 * docs/plans/explain-listing-statuses.md.
 */
export function ListingStatusPicker({
  value,
  current,
  transactionType,
  isBoosted,
  onChange,
}: {
  value: ListingStatus;
  /** The status already saved, so the summary describes a change, not the current state. */
  current: ListingStatus;
  transactionType: TransactionType;
  isBoosted: boolean;
  onChange: (next: ListingStatus) => void;
}) {
  const options = statusOptionsFor(transactionType, current);
  const notice = leavingActiveNotice(value, current, { featured: isBoosted });

  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label="Ad status">
      <p className="text-[12.5px] text-muted m-0">
        Deal done: choose Sold or Rented. Just not available right now: choose Paused.
      </p>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <label
            key={opt.value}
            className={`flex gap-3 items-start rounded-xl border p-3 cursor-pointer bg-surface ${
              selected ? "border-green" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="listing-status"
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="mt-1 accent-[var(--green)]"
            />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-bold text-text">
                {opt.title}
                {opt.value === current && <span className="ml-2 text-[11px] font-semibold text-muted">current</span>}
              </span>
              <span className="block text-[13px] text-text-soft">{opt.summary}</span>
              <ul className="list-disc pl-5 mt-1.5 mb-0 text-[12.5px] text-muted">
                {opt.effects.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </span>
          </label>
        );
      })}
      {notice && (
        <p className="text-[13px] text-text m-0 rounded-lg border border-border bg-surface-alt px-3 py-2" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
