import { classifyVisitEntry, type VisitEntry } from "@bhavano/types/loginNudge";

const VISIT_ENTRY_KEY = "bhavano.visitEntry";

/** How this tab's visit began, decided once from the first page loaded and kept for the rest of
 * the session. Client-only. The login card reads it to stay off visits that started from an ad
 * click or a search result. */
export function recordVisitEntry(): VisitEntry {
  const stored = sessionStorage.getItem(VISIT_ENTRY_KEY);
  if (stored === "ad" || stored === "search" || stored === "other") return stored;
  const entry = classifyVisitEntry(window.location.search, document.referrer);
  sessionStorage.setItem(VISIT_ENTRY_KEY, entry);
  return entry;
}
