"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goLiveTimeText = goLiveTimeText;
/** When a held-back (`scheduled`) ad goes live, as people read it: "3:40 pm" for today, otherwise
 * "23 Oct, 3:40 pm". Always India time: the audience is in India and this also runs on a server
 * (web My listings) whose own clock zone is not theirs. */
function goLiveTimeText(publishAt, now = new Date()) {
    const when = typeof publishAt === "string" ? new Date(publishAt) : publishAt;
    if (Number.isNaN(when.getTime()))
        return "";
    const zone = "Asia/Kolkata";
    const clock = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: zone })
        .format(when)
        .replace(/\s?(am|pm)/i, (_, ap) => ` ${ap.toLowerCase()}`);
    const dayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(d);
    if (dayKey(when) === dayKey(now))
        return clock;
    const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: zone }).format(when);
    return `${day}, ${clock}`;
}
