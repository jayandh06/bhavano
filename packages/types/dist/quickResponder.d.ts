/** The "Quick responder" trust badge: an owner who usually answers buyer messages fast. Earned by
 * behaviour, shown on Featured cards. Computed from the last 90 days of enquiries (an enquiry counts
 * once, from the buyer's first message to the owner's first reply). Aggregate only — no message
 * content or per-conversation timing ever leaves the server. See
 * docs/plans/featured-ad-benefits-and-media-limits.md. */
export declare const QUICK_RESPONDER: {
    /** Look-back window for enquiries. */
    readonly windowDays: 90;
    /** Too few enquiries is noise, not a track record. */
    readonly minEnquiries: 5;
    /** A reply inside this many minutes counts as quick. */
    readonly replyWithinMinutes: 60;
    /** Share of enquiries that must have had a quick reply. */
    readonly minQuickShare: 0.7;
};
export declare function isQuickResponder(enquiries: number, quickReplies: number): boolean;
