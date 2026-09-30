"use client";

import { useEffect } from "react";
import { recordVisitEntry } from "@/lib/visitEntry";

/** Mounted in the root layout so the visit's entry is captured on its first page, whichever page
 * that is. Deciding it later, on a listing page, would see only an internal referrer. */
export function VisitEntryRecorder() {
  useEffect(() => {
    recordVisitEntry();
  }, []);
  return null;
}
