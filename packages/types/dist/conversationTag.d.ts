import type { ConversationType } from "./index";
/** The inbox tag on a staff thread: which kind of Bhavano message it is, so a listing with both
 * a review note and a Boost offer shows two rows that can be told apart at a glance. Null for a
 * buyer↔seller inquiry. */
export declare function staffThreadTag(type: ConversationType): string | null;
