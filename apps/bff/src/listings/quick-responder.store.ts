/** Owner ids currently holding the "Quick responder" badge. A process-local set refreshed by
 * QuickResponderService (every few hours), read synchronously by ListingsService.toCardDto — so the
 * badge needs no schema change, no per-card query and no new constructor dependency. The BFF runs as
 * one container; if it is ever scaled out, each instance refreshes its own copy. Empty until the
 * first refresh after boot, which only means no badge for a few seconds. */
let quickResponderOwners: ReadonlySet<string> = new Set();

export function setQuickResponderOwners(ids: Iterable<string>): void {
  quickResponderOwners = new Set(ids);
}

export function isQuickResponderOwner(ownerId: string): boolean {
  return quickResponderOwners.has(ownerId);
}
