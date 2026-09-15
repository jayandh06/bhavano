"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatUnreadCount = formatUnreadCount;
/** Caps a badge's displayed unread count at "99+" past that point, so a three-digit total never
 * overflows the small circular pill badges the web and mobile apps both use for it. Shared so
 * every unread badge (header total, per-conversation list rows, on any platform) agrees on the
 * same cutoff rather than each one hand-rolling its own. */
function formatUnreadCount(count) {
    return count > 99 ? "99+" : String(count);
}
