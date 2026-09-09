"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addOwnPhotoAction, deleteOwnPhotoAction, rotateOwnPhotoAction, setOwnCoverPhotoAction } from "@/app/actions/listings";
import { labelClass } from "@/lib/formStyles";
import { MAX_PHOTOS } from "@bhavano/types/photoLimits";

/** PhotoProcessingService polls for pending jobs every 3s — this just adds a little margin so a
 * refresh doesn't land in the gap right before the job actually finishes. */
const REPROCESS_DELAY_MS = 4000;

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Owner-facing photo controls for /my-listings/:id/edit: rotate, set-cover (the original
 * "preview locally, save once" interaction, same as the admin panel's RotatablePhotoGrid), plus
 * add/delete (see ListingsService.addPhoto/deletePhoto — post-creation photo mutation, added
 * later than rotate/set-cover). Renders even at zero photos, so a listing that somehow has none
 * can still get its first one added; the caller must not gate this component on `photos.length`. */
export function EditListingPhotos({
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
  // "Save" below actually calls rotateOwnPhotoAction, once, with however many turns were landed
  // on — see docs/plans/listing-photo-orientation.md for why that matters (rotating on every
  // click meant every click triggered its own multi-second reprocess round trip).
  const [previewTurns, setPreviewTurns] = useState<Record<number, number>>({});
  const [savingPhotoNo, setSavingPhotoNo] = useState<number | null>(null);
  const [settingCoverPhotoNo, setSettingCoverPhotoNo] = useState<number | null>(null);
  const [deletingPhotoNo, setDeletingPhotoNo] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  // True from the moment addOwnPhotoAction resolves until the delayed refresh below lands — the
  // new photo's variant URL doesn't exist in R2 yet (the processing poller hasn't run), so
  // there's nothing real to render for it in the meantime except a placeholder tile.
  const [pendingNewPhoto, setPendingNewPhoto] = useState(false);
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
    const result = await rotateOwnPhotoAction(listingId, photoNo, turns);
    if (!result.success) {
      setError(result.error);
      setSavingPhotoNo(null);
      return;
    }
    // The rotated image isn't ready the instant the action resolves — refreshing immediately
    // would just show the same (still-wrong) picture and read as the rotate having failed.
    setTimeout(() => {
      router.refresh();
      setPreviewTurns((prev) => ({ ...prev, [photoNo]: 0 }));
      setSavingPhotoNo(null);
    }, REPROCESS_DELAY_MS);
  }

  async function onSetCover(photoNo: number) {
    setError(null);
    setSettingCoverPhotoNo(photoNo);
    const result = await setOwnCoverPhotoAction(listingId, photoNo);
    if (!result.success) setError(result.error);
    // Unlike rotate, this is instant — a pure ordering reassignment, nothing to reprocess.
    router.refresh();
    setSettingCoverPhotoNo(null);
  }

  async function onAddFileSelected(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setError(`"${file.name}" isn't a supported image format.`);
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await addOwnPhotoAction(listingId, formData);
    setUploading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    // Don't render anything from result.listing directly — its newest photo's variant URL 404s
    // until the processing poller runs. Same delayed-refresh convention as rotate above.
    setPendingNewPhoto(true);
    setTimeout(() => {
      router.refresh();
      setPendingNewPhoto(false);
    }, REPROCESS_DELAY_MS);
  }

  async function onDelete(photoNo: number) {
    setError(null);
    setDeletingPhotoNo(photoNo);
    const result = await deleteOwnPhotoAction(listingId, photoNo);
    if (!result.success) {
      setError(result.error);
      setDeletingPhotoNo(null);
      return;
    }
    // Unlike add, nothing needs reprocessing for a deletion to be reflected — the tile is just
    // gone.
    router.refresh();
    setDeletingPhotoNo(null);
  }

  // Counts the pending placeholder too, so clicking "+ Add" twice in a row (before the first
  // upload's variants are ready) can't race past the cap client-side — not that it matters much,
  // since the server enforces MAX_PHOTOS regardless.
  const atCap = photos.length + (pendingNewPhoto ? 1 : 0) >= MAX_PHOTOS;

  return (
    <div>
      <label className={labelClass}>Photos</label>
      {error && <p className="text-[13px] text-[#b3413a] m-0 mb-2">{error}</p>}
      <div className="flex flex-wrap gap-3">
        {photos.map(({ url, photoNo, updatedAt }, i) => {
          const turns = previewTurns[photoNo] ?? 0;
          const saving = savingPhotoNo === photoNo;
          const deleting = deletingPhotoNo === photoNo;
          const isCover = i === 0;
          // Odd turns (90°/270°) swap the image's effective aspect ratio, which a fixed-size
          // cover crop doesn't accommodate — switch to contain (letterboxed) only while
          // previewing one of those, so the whole frame stays visible to judge the orientation.
          const isSideways = turns % 2 === 1;
          return (
            <div key={photoNo} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- own-photo management, not
                  page content that needs Next's optimizer, and `?t=` cache-busting means the URL
                  itself already changes on every rotate, same reasoning as the admin grid. */}
              <img
                src={`${url}?t=${updatedAt}`}
                alt={`${title} photo ${i + 1}`}
                className={`h-[100px] w-[100px] rounded-lg border border-border block ${
                  isSideways ? "object-contain bg-black" : "object-cover"
                }`}
                style={{
                  opacity: saving || deleting ? 0.5 : 1,
                  transform: turns ? `rotate(${turns * 90}deg)` : undefined,
                  transition: "transform 0.15s ease",
                }}
              />
              {/* Top-left, opposite the rotate control. No separate "current cover" field to
                  check: `photos` is already ordered by displayOrder (see
                  ListingDetailDto.photosFull), so index 0 *is* the cover by construction. */}
              {isCover ? (
                <span className="absolute top-1 left-1 bg-green text-on-green text-[10px] font-bold px-1.5 py-0.5 rounded">
                  Cover
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetCover(photoNo)}
                  disabled={settingCoverPhotoNo !== null}
                  title="Make this the cover photo"
                  className="absolute top-1 left-1 bg-black/55 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border-0 cursor-pointer disabled:cursor-default"
                >
                  {settingCoverPhotoNo === photoNo ? "…" : "☆ Cover"}
                </button>
              )}
              <button
                type="button"
                onClick={() => onPreviewRotate(photoNo)}
                disabled={saving || deleting}
                title="Preview a 90° turn"
                aria-label={`Preview photo ${i + 1} rotated another 90 degrees`}
                className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-black/55 text-white rounded border-0 cursor-pointer disabled:cursor-default text-sm leading-none"
              >
                {saving ? "…" : "⟳"}
              </button>
              {/* Outside the top-right corner (unlike rotate, which sits just inside it) — same
                  overlay position VideoManager uses for its own delete button. */}
              <button
                type="button"
                onClick={() => onDelete(photoNo)}
                disabled={deleting || saving}
                title="Delete this photo"
                aria-label={`Delete photo ${i + 1}`}
                className="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] rounded-full border-0 bg-surface text-[#b3413a] font-bold cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.3)] disabled:cursor-default"
              >
                {deleting ? "…" : "×"}
              </button>
              {turns !== 0 && (
                <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => onSave(photoNo)}
                    disabled={saving}
                    className="flex-1 py-1 text-[10px] font-bold rounded border-0 bg-green text-on-green cursor-pointer disabled:cursor-default"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancelPreview(photoNo)}
                    disabled={saving}
                    title="Discard preview"
                    aria-label={`Discard the unsaved rotation preview for photo ${i + 1}`}
                    className="w-5 py-1 text-[10px] font-bold rounded border-0 bg-black/55 text-white cursor-pointer disabled:cursor-default"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {pendingNewPhoto && (
          <div className="h-[100px] w-[100px] rounded-lg bg-surface-alt flex items-center justify-center text-[11px] text-muted text-center px-1">
            Processing…
          </div>
        )}

        {!atCap && (
          <label
            title={`Add a photo (up to ${MAX_PHOTOS})`}
            className="h-[100px] w-[100px] rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted cursor-pointer text-[12px] font-bold"
          >
            {uploading ? "Uploading…" : "+ Add"}
            <input
              type="file"
              accept={ALLOWED_PHOTO_TYPES.join(",")}
              disabled={uploading}
              onChange={(e) => {
                void onAddFileSelected(e.target.files?.[0]);
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );
}
