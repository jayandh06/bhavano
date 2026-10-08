import type { DuplicatePhotoErrorBody } from "@bhavano/types/duplicatePhoto";

export class DuplicatePhotoError extends Error {
  readonly body: DuplicatePhotoErrorBody;

  constructor(body: DuplicatePhotoErrorBody) {
    super(body.message);
    this.name = "DuplicatePhotoError";
    this.body = body;
  }
}

export function isDuplicatePhotoErrorBody(value: unknown): value is DuplicatePhotoErrorBody {
  if (!value || typeof value !== "object") return false;
  const v = value as DuplicatePhotoErrorBody;
  return v.code === "DUPLICATE_PHOTO" && Array.isArray(v.duplicatePhotoNos);
}
