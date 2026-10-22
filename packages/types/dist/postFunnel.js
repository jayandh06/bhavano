"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizePostFieldEvents = summarizePostFieldEvents;
function median(values) {
    if (values.length === 0)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
/** Turns raw `/post/field` events into the blockers and exits tables. `events` are the PageView rows (session id +
 * path); malformed paths are ignored. A session counts as having *exited* only if it sent `details_exit` and never
 * reached Preview (`previewSessionIds`). */
function summarizePostFieldEvents(events, parse, previewSessionIds) {
    const touched = new Set();
    const blocked = new Set();
    const firstTouchMs = [];
    const blockerMap = new Map();
    const exitMap = new Map();
    for (const { sessionId, path } of events) {
        const e = parse(path);
        if (!e)
            continue;
        if (e.event === "first_touch") {
            touched.add(sessionId);
            if (e.ms !== null)
                firstTouchMs.push(e.ms);
        }
        else if (e.event === "preview_blocked") {
            blocked.add(sessionId);
            const field = e.field ?? "(unknown)";
            const key = `${field}|${e.category ?? ""}`;
            const row = blockerMap.get(key) ?? { field, category: e.category, sessions: new Set(), taps: 0 };
            row.sessions.add(sessionId);
            row.taps += 1;
            blockerMap.set(key, row);
        }
        else if (e.event === "details_exit" && !previewSessionIds.has(sessionId)) {
            const key = e.field ?? "";
            const row = exitMap.get(key) ?? { field: e.field, sessions: new Set(), ms: [] };
            row.sessions.add(sessionId);
            if (e.ms !== null)
                row.ms.push(e.ms);
            exitMap.set(key, row);
        }
    }
    const firstTouch = median(firstTouchMs);
    return {
        sessionsTouched: touched.size,
        sessionsBlocked: blocked.size,
        medianSecondsToFirstTouch: firstTouch === null ? null : Math.round(firstTouch / 1000),
        blockers: [...blockerMap.values()]
            .map((r) => ({ field: r.field, category: r.category, sessions: r.sessions.size, taps: r.taps }))
            .sort((a, b) => b.sessions - a.sessions || b.taps - a.taps)
            .slice(0, 20),
        exits: [...exitMap.values()]
            .map((r) => {
            const m = median(r.ms);
            return { field: r.field, sessions: r.sessions.size, medianSeconds: m === null ? null : Math.round(m / 1000) };
        })
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 20),
    };
}
