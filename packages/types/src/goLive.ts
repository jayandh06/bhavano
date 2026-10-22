/** When a held-back (`scheduled`) ad goes live, as people read it: "3:40 pm" for today, otherwise
 * "23 Oct, 3:40 pm". Always India time: the audience is in India and this also runs on a server
 * (web My listings) whose own clock zone is not theirs. */
export function goLiveTimeText(publishAt: string | Date, now: Date = new Date()): string {
  const when = typeof publishAt === "string" ? new Date(publishAt) : publishAt;
  if (Number.isNaN(when.getTime())) return "";
  const zone = "Asia/Kolkata";
  const clock = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: zone })
    .format(when)
    .replace(/\s?(am|pm)/i, (_, ap: string) => ` ${ap.toLowerCase()}`);
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(d);
  if (dayKey(when) === dayKey(now)) return clock;
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: zone }).format(when);
  return `${day}, ${clock}`;
}
