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
  photos: { url: string; photoNo: number; updatedAt: number }[];
}) {
  const router = useRouter();
  // Purely local, unsaved turns (0-3) per photo — cycling this costs nothing server-side. Only
  // "Save" below actually calls rotatePhotoAction, once, with however many turns the admin landed
  // on. Rotating on every single click used to mean every click triggered its own multi-second
  // R2 download/resize/upload/purge cycle even when the very next click immediately superseded
  // it — see docs/plans/listing-photo-orientation.md.
  const [previewTurns, setPreviewTurns] = useState<Record<number, number>>({});
  const [savingPhotoNo, setSavingPhotoNo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onPreviewRotate(photoNo: number) {
    setPreviewTurns((prev) => ({ ...prev, [photoNo]: ((prev[photoNo] ?? 0) + 1) % 4 }));
  }

  function onCancelPreview(photoNo: number) {
    setPreviewTurns((prev) => ({ ...prev, [photoNo]: 0 }));
  }

  async function onSave(photoNo: number) {
    const turns = previewTurns[photoNo] ?? 0;
    if (turns === 0) return;
    setError(null);
    setSavingPhotoNo(photoNo);
    const result = await rotatePhotoAction(listingId, photoNo, turns);
    if (!result.success) {
      setError(result.error);
      setSavingPhotoNo(null);
      return;
    }
    // The rotated image isn't ready the instant the action resolves — see rotatePhotoAction's
    // own comment. Refreshing immediately would just show the same (still-wrong) picture and
    // read as the rotate having silently failed.
    setTimeout(() => {
      router.refresh();
      setPreviewTurns((prev) => ({ ...prev, [photoNo]: 0 }));
      setSavingPhotoNo(null);
    }, REPROCESS_DELAY_MS);
  }

  return (
    <>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5, margin: "0 0 8px" }}>{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        {photos.map(({ url, photoNo, updatedAt }, i) => {
          const turns = previewTurns[photoNo] ?? 0;
          const saving = savingPhotoNo === photoNo;
          // Odd turns (90°/270°) swap the image's effective aspect ratio, which a fixed-height
          // cover crop doesn't accommodate — switch to contain (letterboxed) only while previewing
          // one of those, so the admin can still see the whole frame to judge the orientation.
          const isSideways = turns % 2 === 1;
          return (
            <div key={photoNo} style={{ position: "relative" }}>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {/* Plain <img>, not next/image — these are moderation targets, not site content,
                    so no optimization/caching pipeline should sit in front of whatever the admin
                    is trying to actually inspect. The variant's storage key never changes when
                    it's rotated (see apps/bff/src/uploads/photo-keys.ts) — only its bytes do — so
                    `?t=` is there to stop a browser (or CDN) that already cached the old bytes at
                    this exact URL from continuing to serve them after a rotate. Deliberately the
                    photo's updatedAt timestamp, NOT its rotation value — rotation cycles back to
                    0, and every photo starts at rotation 0, so a value that repeats would collide
                    with a request cached from before the photo was ever rotated at all (this
                    actually happened — see docs/plans/listing-photo-orientation.md). A timestamp
                    never repeats. The turns*90deg transform below is a local, unsaved preview
                    only — it never touches this URL or the actual file. */}
                <img
                  src={`${url}?t=${updatedAt}`}
                  alt={`${title} photo ${i + 1}`}
                  style={{
                    width: "100%",
                    height: 140,
                    objectFit: isSideways ? "contain" : "cover",
                    background: isSideways ? "#000" : undefined,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    display: "block",
                    opacity: saving ? 0.5 : 1,
                    transform: turns ? `rotate(${turns * 90}deg)` : undefined,
                    transition: "transform 0.15s ease",
                  }}
                />
              </a>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onPreviewRotate(photoNo);
                }}
                disabled={saving}
                title="Preview a 90° turn"
                aria-label={`Preview photo ${i + 1} rotated another 90 degrees`}
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
                  cursor: saving ? "default" : "pointer",
                  fontSize: 15,
                  lineHeight: 1,
                }}
              >
                {saving ? "…" : "⟳"}
              </button>
              {turns !== 0 && (
                <div style={{ position: "absolute", bottom: 6, left: 6, right: 6, display: "flex", gap: 6 }}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onSave(photoNo);
                    }}
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: "5px 0",
                      fontSize: 11.5,
                      fontWeight: 700,
                      border: "none",
                      borderRadius: 6,
                      background: "var(--green)",
                      color: "var(--on-green)",
                      cursor: saving ? "default" : "pointer",
                    }}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onCancelPreview(photoNo);
                    }}
                    disabled={saving}
                    title="Discard preview"
                    aria-label={`Discard the unsaved rotation preview for photo ${i + 1}`}
                    style={{
                      width: 26,
                      padding: "5px 0",
                      fontSize: 11.5,
                      fontWeight: 700,
                      border: "none",
                      borderRadius: 6,
                      background: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      cursor: saving ? "default" : "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
