"use client";

import { useState } from "react";
import type { ListingDetailDto } from "@bhavano/types";
import { deleteVideoAction } from "@/app/actions/listings";
import { addVideoToListing } from "@/lib/videoUpload";

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/x-matroska"];

/** Post-creation video add/delete — the one place a seller can attach media to a listing after
 * the fact (unlike photos, fully immutable post-creation). Exists because boosting (which can
 * elevate an individual seller's video entitlement) only ever happens after a listing already
 * exists — see docs/plans/listing-video-uploads.md. Owns its own copy of the listing so it can
 * re-render immediately from the fresh `ListingDetailDto` every add/delete call already returns,
 * without a full page reload. */
export function VideoManager({ listing: initialListing, accessToken }: { listing: ListingDetailDto; accessToken: string }) {
  const [listing, setListing] = useState(initialListing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entitlement = listing.videoEntitlement;

  async function onFileSelected(files: FileList | null) {
    const file = files?.[0];
    if (!file || !entitlement) return;
    setError(null);

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setError(`"${file.name}" isn't a supported video format.`);
      return;
    }

    setPending(true);
    try {
      const updated = await addVideoToListing(file, listing.id, accessToken);
      setListing(updated);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload video");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(videoId: string) {
    setPending(true);
    setError(null);
    const result = await deleteVideoAction(listing.id, videoId);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setListing(result.listing);
  }

  if (!entitlement) return null;
  const atCap = listing.videos.length >= entitlement.maxVideos;

  return (
    <div className="flex flex-col gap-2">
      {listing.videos.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {listing.videos.map((video) => (
            <div key={video.id} className="relative">
              {video.status === "done" ? (
                <video src={video.url} poster={video.posterUrl} className="h-[90px] w-[90px] object-cover rounded-lg bg-black" muted />
              ) : (
                <div className="h-[90px] w-[90px] rounded-lg bg-surface-alt flex items-center justify-center text-[11px] text-muted text-center px-1">
                  {video.status === "failed" ? "Processing failed" : "Processing…"}
                </div>
              )}
              <button
                type="button"
                onClick={() => onDelete(video.id)}
                disabled={pending}
                className="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] rounded-full border-0 bg-surface text-[#b3413a] font-bold cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {atCap ? (
        entitlement.canUpgradeByBoosting && (
          <p className="text-xs text-muted m-0">
            Boost this listing to add up to 3 videos, up to 2 minutes each.
          </p>
        )
      ) : (
        <label className="text-[13px] font-bold text-green cursor-pointer">
          {pending ? "Uploading…" : `+ Add video (up to ${entitlement.maxDurationSec}s)`}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/x-matroska"
            disabled={pending}
            onChange={(e) => {
              void onFileSelected(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>
      )}
      {error && <p className="text-[#b3413a] text-[13px] m-0">{error}</p>}
    </div>
  );
}
