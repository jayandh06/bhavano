"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ListingClaimPreviewDto } from "@bhavano/types";
import { claimListingAction } from "@/app/actions/listings";
import { buildListingPath } from "@/lib/listingPath";
import { useAuthGate } from "./AuthGateProvider";

/** Where a seller lands from the link an admin sent after preparing their ad. Unlike the outreach
 * claim (ClaimListing), nothing happens on load: the seller sees the ad first, and publishing it
 * is their own press of a button after signing in with the phone staff took down. See
 * docs/plans/admin-assisted-posting.md. */
export function AssistedClaim({ preview }: { preview: ListingClaimPreviewDto }) {
  const { requireLogin } = useAuthGate();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(preview.claimed);

  async function publish() {
    setPending(true);
    setError(null);
    const result = await claimListingAction(preview.id, "assisted");
    if (result.requiresLogin) {
      setPending(false);
      // The claim only succeeds for the exact phone staff took down, so Google sign-in isn't offered.
      requireLogin({ onSuccess: () => void publish(), phoneOnly: true });
      return;
    }
    if (result.success) {
      router.replace(result.listing.publishState === "live" ? buildListingPath(result.listing) : "/my-listings");
      return;
    }
    setPending(false);
    if (result.alreadyClaimed) {
      setAlreadyClaimed(true);
      return;
    }
    setError(result.error);
  }

  if (alreadyClaimed) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg text-text p-6">
        <div className="text-center max-w-sm">
          <p className="text-sm font-bold text-text mb-2">This ad has already been published</p>
          <p className="text-sm text-muted mb-4">If it was you, you&apos;ll find it in your listings.</p>
          <Link href="/my-listings" className="text-sm font-bold text-green">
            Go to my listings →
          </Link>
        </div>
      </div>
    );
  }

  const firstName = preview.claimName?.trim().split(/\s+/)[0];

  return (
    <div className="min-h-dvh bg-bg text-text px-4 py-8 flex justify-center">
      <div className="w-full max-w-[440px] flex flex-col gap-4">
        <div>
          <h1 className="font-lora text-xl font-bold m-0">
            {firstName ? `${firstName}, your ad is ready` : "Your ad is ready"}
          </h1>
          <p className="text-sm text-text-soft mt-1.5 mb-0">
            Bhavano prepared this ad for you. Sign in with{" "}
            <span className="font-bold whitespace-nowrap">{preview.maskedPhone ?? "your phone"}</span> to check it and
            publish.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {preview.photoUrl && (
            // A single CDN image on a private page: plain <img> keeps it simple.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.photoUrl} alt="" className="w-full aspect-[4/3] object-cover block bg-surface-alt" />
          )}
          <div className="p-4 flex flex-col gap-1.5">
            <div className="text-lg font-bold">
              {preview.price}
              {preview.priceQualifier && <span className="text-sm font-normal text-muted"> {preview.priceQualifier}</span>}
            </div>
            <div className="text-[15px] font-bold">{preview.title}</div>
            <div className="text-[13px] text-muted">
              {preview.area}, {preview.cityName}
              {preview.photoCount > 1 && ` · ${preview.photoCount} photos`}
            </div>
            {preview.specs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {preview.specs.map((spec) => (
                  <span key={spec} className="rounded-full bg-surface-alt px-2.5 py-0.5 text-[12px] text-text-soft">
                    {spec}
                  </span>
                ))}
              </div>
            )}
            {preview.description && (
              <p className="text-[13px] text-text-soft mt-2 mb-0 whitespace-pre-line line-clamp-6">{preview.description}</p>
            )}
          </div>
        </div>

        {error && <p className="text-[13px] text-[#b3413a] m-0">{error}</p>}

        <button
          type="button"
          onClick={() => void publish()}
          disabled={pending}
          className="w-full rounded-xl bg-green px-4 py-3 text-[15px] font-bold text-[color:var(--on-green)] border-0 cursor-pointer disabled:opacity-60"
        >
          {pending ? "Publishing…" : "Sign in and publish"}
        </button>
        <p className="text-[12px] text-muted m-0">
          You can edit or remove the ad any time after publishing, from My listings. Something wrong? Reply to the
          message we sent you and we&apos;ll fix it before you publish.
        </p>
      </div>
    </div>
  );
}
