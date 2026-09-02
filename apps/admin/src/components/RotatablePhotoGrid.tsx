"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { rotatePhotoAction } from "@/app/actions/admin";

/** PhotoProcessingService polls for pending jobs every 3s (POLL_INTERVAL_MS) — this just adds a
 * little margin so a refresh doesn't land in the gap right before the job actually finishes. */
const REPROCESS_DELAY_MS = 4000;

export function RotatablePhotoGrid({
  listingId,
  title,
  photos,
}: {
  listingId: string;
  title: string;
  photos: { url: string; photoNo: number; rotation: number }[];
}) {
  const router = useRouter();
  const [rotatingPhotoNo, setRotatingPhotoNo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRotate(photoNo: number) {
    setError(null);
    setRotatingPhotoNo(photoNo);
    const result = await rotatePhotoAction(listingId, photoNo);
    if (!result.success) {
      setError(result.error);
      setRotatingPhotoNo(null);
      return;
    }
    // The rotated image isn't ready the instant the action resolves — see rotatePhotoAction's
    // own comment. Refreshing immediately would just show the same (still-wrong) picture and
    // read as the rotate having silently failed.
    setTimeout(() => {
      router.refresh();
      setRotatingPhotoNo(null);
    }, REPROCESS_DELAY_MS);
  }

  return (
    <>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5, margin: "0 0 8px" }}>{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        {photos.map(({ url, photoNo, rotation }, i) => (
          <div key={photoNo} style={{ position: "relative" }}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {/* Plain <img>, not next/image — these are moderation targets, not site content,
                  so no optimization/caching pipeline should sit in front of whatever the admin
                  is trying to actually inspect. The variant's storage key never changes when it's
                  rotated (see apps/bff/src/uploads/photo-keys.ts) — only its bytes do — so `?r=`
                  is there to stop a browser (or CDN) that already cached the old bytes at this
                  exact URL from continuing to serve them after a rotate. */}
              <img
                src={`${url}?r=${rotation}`}
                alt={`${title} photo ${i + 1}`}
                style={{
                  width: "100%",
                  height: 140,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  display: "block",
                  opacity: rotatingPhotoNo === photoNo ? 0.5 : 1,
                }}
              />
            </a>
            <button
              onClick={(e) => {
                e.preventDefault();
                onRotate(photoNo);
              }}
              disabled={rotatingPhotoNo !== null}
              title="Rotate 90°"
              aria-label={`Rotate photo ${i + 1} 90 degrees`}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: rotatingPhotoNo !== null ? "default" : "pointer",
                fontSize: 15,
                lineHeight: 1,
              }}
            >
              {rotatingPhotoNo === photoNo ? "…" : "⟳"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
