import { getMarket, type MarketId } from "./market";

/** When a held-back (`scheduled`) ad goes live, as people read it: "3:40 pm" for today, otherwise
 * "23 Oct, 3:40 pm". In the market's time zone (India unless another market is named): the audience is
 * there and this also runs on a server (web My listings) whose own clock zone is not theirs. */
export function goLiveTimeText(publishAt: string | Date, now: Date = new Date(), marketId?: MarketId): string {
  const when = typeof publishAt === "string" ? new Date(publishAt) : publishAt;
  if (Number.isNaN(when.getTime())) return "";
  const { timeZone: zone, locale } = getMarket(marketId);
  const clock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12: true, timeZone: zone })
    .format(when)
    .replace(/\s?(am|pm)/i, (_, ap: string) => ` ${ap.toLowerCase()}`);
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(d);
  if (dayKey(when) === dayKey(now)) return clock;
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: zone }).format(when);
  return `${day}, ${clock}`;
}
