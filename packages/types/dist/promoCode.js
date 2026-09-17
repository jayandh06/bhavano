"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTIVE_PROMO_CODE = void 0;
exports.promoPriceFor = promoPriceFor;
/**
 * The promo code the app currently applies for the seller rather than asking them to type it.
 *
 * Shared because three places need the same string and were each holding their own copy: the web
 * post-ad picker, the mobile one, and now the BFF's admin-sent Boost promotion, which quotes the
 * offer price in the message and must quote the one the checkout will actually charge.
 *
 * **This constant grants nothing.** The discount exists only if a `DiscountCode` row with this
 * code is active, unexpired and under its redemption caps (managed from the admin discount-codes
 * screen); every price shown is resolved against that row. Pointing this at a code that does not
 * exist makes the auto-apply a no-op, not a free boost.
 */
exports.ACTIVE_PROMO_CODE = "BHAVANO-SEP";
/**
 * A discounted rupee price, rounded the way `PaymentsService.previewBoostPricing` rounds it.
 *
 * Deliberately the *preview's* arithmetic and not `applyDiscount`'s: that one works in paise and
 * can land on a half rupee (₹199 at 50% is ₹99.50), while every screen and message quotes whole
 * rupees. Matching the preview keeps the figure in an email identical to the figure on the screen
 * it links to — the charge can then be up to 50 paise lower than quoted, which is the harmless
 * direction for a rounding difference to fall.
 */
function promoPriceFor(baseRupees, discountPercent) {
    return Math.round((baseRupees * (100 - discountPercent)) / 100);
}
