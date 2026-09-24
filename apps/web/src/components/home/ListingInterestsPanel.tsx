"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingInterestDto } from "@bhavano/types";
import {
  fetchListingInterestsAction,
  openInterestConversationAction,
} from "@/app/actions/listings";

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Owner panel on My listings — who's interested (Level 1 Message-only).
 * See docs/plans/login-gated-listing-interest-owner-notify.md.
 */
export function ListingInterestsPanel({
  listingId,
  interestCount,
}: {
  listingId: string;
  interestCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ListingInterestDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (items) return;
    setLoading(true);
    setError(null);
    const page = await fetchListingInterestsAction(listingId);
    setLoading(false);
    if (!page) {
      setError("Couldn't load interested buyers");
      return;
    }
    setItems(page.items);
  }

  async function onMessage(userId: string, existingConversationId: string | null) {
    if (existingConversationId) {
      router.push(`/messages/${existingConversationId}`);
      return;
    }
    setMessagingUserId(userId);
    const result = await openInterestConversationAction(listingId, userId);
    setMessagingUserId(null);
    if (result.requiresLogin || !result.conversationId) {
      setError(result.error ?? "Couldn't open the conversation");
      return;
    }
    router.push(`/messages/${result.conversationId}`);
  }

  if (interestCount <= 0) return null;

  return (
    <div className="mt-3 w-full basis-full">
      <button
        type="button"
        onClick={() => void toggle()}
        className="text-[12.5px] font-bold text-green bg-transparent border-none p-0 cursor-pointer underline"
      >
        {open ? "Hide" : "Show"} interested buyers ({interestCount})
      </button>
      {open && (
        <div className="mt-2 border border-border rounded-lg p-3 flex flex-col gap-2.5 bg-surface">
          {loading && <p className="m-0 text-[13px] text-muted">Loading…</p>}
          {error && <p className="m-0 text-[13px] text-[#b3413a]">{error}</p>}
          {items && items.length === 0 && (
            <p className="m-0 text-[13px] text-muted">No interested buyers yet.</p>
          )}
          {items?.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold text-text">
                  {row.userName?.trim() || "Interested buyer"}
                </div>
                <div className="text-[11.5px] text-muted">
                  Interested {timeFormatter.format(new Date(row.lastSeenAt))}
                </div>
              </div>
              <button
                type="button"
                disabled={messagingUserId === row.userId}
                onClick={() => void onMessage(row.userId, row.conversationId)}
                className="text-[12.5px] font-bold text-green border-[1.5px] border-green rounded-lg px-3 py-1.5 bg-transparent cursor-pointer disabled:opacity-60"
              >
                {messagingUserId === row.userId ? "Opening…" : "Message"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
