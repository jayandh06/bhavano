"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURED_BENEFITS = void 0;
const photoLimits_1 = require("./photoLimits");
const videoLimits_1 = require("./videoLimits");
/** What a Featured ad actually gets, in the words shown on the post-ad offer screen (web and mobile
 * share this list so they can never disagree). Every line is true today: the card styling and photo
 * cycling are driven by `isBoosted`, ordering by `boostRank`, the home rail by the Featured rail, Instant
 * Alerts are included in every boost, and the media limits come from the same constants the BFF enforces.
 * Never promise a fixed position: only 8 guaranteed slots exist across the first two pages. See
 * docs/plans/featured-ad-benefits-and-media-limits.md. */
exports.FEATURED_BENEFITS = [
    "A gold Featured badge and card styling",
    "Priority placement above regular ads (the exact spot is not guaranteed)",
    "May appear in the Featured section on the home page",
    "Your card cycles through your photos as people browse",
    "Instant alerts by email and WhatsApp when someone messages you",
    `Up to ${photoLimits_1.PHOTO_LIMITS.elevated.maxPhotos} photos and ${videoLimits_1.VIDEO_LIMITS.elevated.maxVideos} videos (up to ${videoLimits_1.VIDEO_LIMITS.elevated.maxDurationSec / 60} minutes each)`,
];
