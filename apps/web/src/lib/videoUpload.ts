"use client";

import type { CreatedVideoInput, ListingDetailDto } from "@bhavano/types";

// Video can't go through a Next.js Server Action (photos' path — see uploadPhotoAction) because
// Server Actions have a 1MB default body limit. This is the second deliberate exception to "no
// direct browser->BFF calls" (the first is the Socket.IO connection, see lib/socket.ts) — the
// browser talks straight to the BFF over NEXT_PUBLIC_BFF_URL, using XMLHttpRequest instead of
// fetch() specifically because only XHR exposes upload progress events, which matter here: a
// 200MB upload with zero feedback on a slow connection reads as broken, not just slow.
const BFF_URL = process.env.NEXT_PUBLIC_BFF_URL ?? "http://localhost:4000";

/** No signature verification (this only decides whether to bother starting a long upload, the
 * BFF is still the one actually enforcing auth) — mirrors lib/session.ts's decodeJwtExpiryMs, but
 * browser-safe (atob, not Node's Buffer) since this module runs client-side. */
function isAccessTokenValid(accessToken: string): boolean {
  try {
    const payload = accessToken.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof json.exp === "number" && json.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Your session expired — please sign in again before uploading.");
    this.name = "SessionExpiredError";
  }
}

/** xhr.onerror only — a connection-level failure (dropped mid-upload, DNS hiccup), never an HTTP
 * status the server actually returned. That distinction is what makes it safe to retry: a real
 * 4xx/5xx (bad file, auth, server rejected it) won't get a different answer next time, but a
 * mobile network blip very often clears within a couple of seconds. */
class TransientUploadError extends Error {
  constructor() {
    super("Network error during upload");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function xhrJsonOnce<T>(method: string, url: string, accessToken: string, formData: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error("Unexpected response from server"));
        }
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string | string[] };
        if (parsed.message) message = Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
      } catch {
        // Keep the generic message above.
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new TransientUploadError());

    xhr.send(formData);
  });
}

// Total attempts = 1 + this. FormData (and the File inside it) isn't consumed by xhr.send, so the
// same instance can be resent across attempts.
const UPLOAD_RETRIES = 2;
const UPLOAD_RETRY_DELAY_MS = 1500;

async function xhrJson<T>(method: string, url: string, accessToken: string, formData: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await xhrJsonOnce<T>(method, url, accessToken, formData, onProgress);
    } catch (error) {
      if (!(error instanceof TransientUploadError) || attempt >= UPLOAD_RETRIES) throw error;
      await sleep(UPLOAD_RETRY_DELAY_MS);
    }
  }
}

/** Wizard-time upload — runs before the listing exists (the client's pre-minted `listingId`). */
export async function uploadVideoDirect(
  file: File,
  listingId: string,
  accessToken: string,
  onProgress?: (fraction: number) => void,
): Promise<CreatedVideoInput> {
  if (!isAccessTokenValid(accessToken)) throw new SessionExpiredError();

  const formData = new FormData();
  formData.set("file", file);
  formData.set("listingId", listingId);
  return xhrJson<CreatedVideoInput>("POST", `${BFF_URL}/uploads/video`, accessToken, formData, onProgress);
}

/** Adds a video to an already-existing listing — a single request (unlike the wizard's
 * upload-then-attach split), since the listing definitely already exists by this point. */
export async function addVideoToListing(
  file: File,
  listingId: string,
  accessToken: string,
  onProgress?: (fraction: number) => void,
): Promise<ListingDetailDto> {
  if (!isAccessTokenValid(accessToken)) throw new SessionExpiredError();

  const formData = new FormData();
  formData.set("file", file);
  return xhrJson<ListingDetailDto>("POST", `${BFF_URL}/listings/${listingId}/videos`, accessToken, formData, onProgress);
}
