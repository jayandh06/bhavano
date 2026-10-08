/** Thrown (400) when ModerationService finds an uploaded photo perceptually matching a photo
 * already used on another user's listing in the same city — see ModerationService's own doc
 * comment for the fraud this guards against. Structured, not just a plain message, so the client
 * can highlight/let the seller remove exactly the flagged photo(s) instead of guessing which of
 * up to MAX_PHOTOS it was. */
export interface DuplicatePhotoErrorBody {
  code: "DUPLICATE_PHOTO";
  message: string;
  /** 1-based photoNo values of the uploaded photos that matched. */
  duplicatePhotoNos: number[];
}
