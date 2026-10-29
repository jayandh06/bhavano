"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ListingInterestDto } from "@bhavano/types";
import type { LeadContactSummaryDto } from "@bhavano/types/seekerContact";
import { whatsAppChatUrl } from "@bhavano/types/whatsapp";
import {
  fetchListingInterestsAction,
  openInterestConversationAction,
  unlockLeadContactAction,
} from "@/app/actions/listings";
import { useBuyCredits } from "./BuyCreditsProvider";
import { reportPostAction } from "@/lib/postActionTrail";

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const actionButton =
  "text-[12.5px] font-bold text-green border-[1.5px] border-green rounded-lg px-3 py-1.5 bg-transparent cursor-pointer disabled:opacity-60 no-underline";

/**
 * Owner panel on My listings — who's interested. Message always; when an admin has turned on seeker contact, a Featured ad also shows the person's number
 * (Call / WhatsApp) free, and any other ad can unlock it one person at a time with a contact-reveal credit.
 * See docs/plans/login-gated-listing-interest-owner-notify.md and docs/plans/featured-seeker-contact-for-owners.md.
 */
export function ListingInterestsPanel({
  listingId,
  interestCount,
}: {
  listingId: string;
  interestCount: number;
}) {
  const router = useRouter();
  const { buyCredits } = useBuyCredits();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ListingInterestDto[] | null>(null);
  const [summary, setSummary] = useState<LeadContactSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);

  async function load() {
    const page = await fetchListingInterestsAction(listingId);
    if (!page) return false;
    setItems(page.items);
    setSummary(page.leadContact ?? null);
    return true;
  }

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (items) return;
    setLoading(true);
    setError(null);
    const ok = await load();
    setLoading(false);
    if (!ok) setError("Couldn't load interested buyers");
  }

  async function onMessage(userId: string, existingConversationId: string | null) {
    if (existingConversationId) {
      router.push(`/messages/${existingConversationId}`);
      return;
    }
    setMessagingUserId(userId);
    const result = await openInterestConversationAction(listingId, userId);
    setMessagingUserId(null);
    if (result.requiresLogin) {
      setError("Sign in to message this buyer");
      return;
    }
    if (!result.conversationId) {
      setError(result.error ?? "Couldn't open the conversation");
      return;
    }
    router.push(`/messages/${result.conversationId}`);
  }

  async function onUnlock(userId: string) {
    setUnlockingUserId(userId);
    setError(null);
    reportPostAction("upsell", "unlock_tapped", { surface: "interest_contact" });
    const result = await unlockLeadContactAction(listingId, userId);
    setUnlockingUserId(null);
    if (result.requiresLogin) {
      setError("Sign in to unlock this contact");
      return;
    }
    if ("insufficientCredits" in result && result.insufficientCredits) {
      buyCredits({
        creditPackSize: summary?.creditPackSize,
        creditPackPriceRupees: summary?.creditPackPriceRupees,
        listingId,
        // The webhook grants the credits a moment after checkout reports success; refresh the list then, and the owner taps Unlock again.
        onPurchased: () => setTimeout(() => void load(), 5000),
      });
      return;
    }
    if ("error" in result) {
      setError(result.error);
      return;
    }
    await load();
  }

  /** Records that the owner opened a number they were already allowed to see; no cost, no wait. */
  function noteContactTap(userId: string) {
    void unlockLeadContactAction(listingId, userId);
  }

  if (interestCount <= 0) return null;

  const unlockLabel = (row: ListingInterestDto) => {
    if (unlockingUserId === row.userId) return "Unlocking…";
    if (!summary) return "Unlock contact";
    if (summary.freeLeadReveals > 0) return "Unlock contact (free)";
    if (summary.creditsRemaining > 0) return "Unlock contact · 1 credit";
    return `Unlock contact · ₹${summary.creditPackPriceRupees} for ${summary.creditPackSize}`;
  };

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
                  {row.revealedYourContact && (
                    <span className="ml-2 text-[11px] font-bold text-green border border-green rounded-full px-2 py-0.5 align-middle">Unlocked your number</span>
                  )}
                </div>
                <div className="text-[11.5px] text-muted">
                  Interested {timeFormatter.format(new Date(row.lastSeenAt))}
                </div>
                {row.contact === "available" && row.phone && (
                  <div className="text-[13px] font-bold text-text mt-0.5">{row.phone}</div>
                )}
                {row.contact === "unlockable" && row.phoneMasked && (
                  <div className="text-[13px] text-muted mt-0.5">{row.phoneMasked}</div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {row.contact === "available" && row.phone && (
                  <>
                    <a href={`tel:${row.phone}`} onClick={() => noteContactTap(row.userId)} className={actionButton}>
                      Call
                    </a>
                    {whatsAppChatUrl(row.phone, "") && (
                      <a
                        href={whatsAppChatUrl(row.phone, "") ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => noteContactTap(row.userId)}
                        className={actionButton}
                      >
                        WhatsApp
                      </a>
                    )}
                  </>
                )}
                {row.contact === "unlockable" && (
                  <button type="button" disabled={unlockingUserId === row.userId} onClick={() => void onUnlock(row.userId)} className={actionButton}>
                    {unlockLabel(row)}
                  </button>
                )}
                <button
                  type="button"
                  disabled={messagingUserId === row.userId}
                  onClick={() => void onMessage(row.userId, row.conversationId)}
                  className={actionButton}
                >
                  {messagingUserId === row.userId ? "Opening…" : "Message"}
                </button>
              </div>
            </div>
          ))}
          {summary?.enabled && !summary.featured && items?.some((r) => r.contact === "unlockable") && (
            <p className="m-0 text-[12px] text-muted">
              A Featured ad shows every interested person&rsquo;s number free.{" "}
              <Link
                href={`/my-listings?openBoost=${listingId}`}
                onClick={() => reportPostAction("upsell", "clicked", { surface: "interest_contact" })}
                className="font-bold text-green underline"
              >
                Make it Featured
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
