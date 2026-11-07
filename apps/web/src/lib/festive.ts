/** Festival greetings shown on the home page for a few days around the date, then gone without a deploy.
 * Times are India time (+05:30). Diwali 2026: Lakshmi Puja on Sunday 8 Nov, shown 5 to 11 Nov inclusive. Add next year's window here. */
export const DIWALI_WINDOWS = [{ from: "2026-11-05T00:00:00+05:30", until: "2026-11-12T00:00:00+05:30" }] as const;

/** `?festive=diwali` previews the greeting outside its dates (and `?festive=off` hides it), so it can be checked any day. */
export function showDiwali(now: Date = new Date(), override?: string | string[]): boolean {
  if (override === "diwali") return true;
  if (override === "off") return false;
  const t = now.getTime();
  return DIWALI_WINDOWS.some((w) => t >= Date.parse(w.from) && t < Date.parse(w.until));
}
