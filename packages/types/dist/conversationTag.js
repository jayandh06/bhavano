"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffThreadTag = staffThreadTag;
/** The inbox tag on a staff thread: which kind of Bhavano message it is, so a listing with both
 * a review note and a Boost offer shows two rows that can be told apart at a glance. Null for a
 * buyer↔seller inquiry. */
function staffThreadTag(type) {
    if (type === "moderation")
        return "Bhavano · Listing review";
    if (type === "announcement")
        return "Bhavano · Boost offer";
    return null;
}
