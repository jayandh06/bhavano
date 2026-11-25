/** Text shared by the website's homepage sections and the app's end-of-feed section, so the two
 * can never say different things about how Bhavano works. See docs/plans/homepage-seo-aeo-structure.md.
 *
 * Only claims that are already true on the site: browsing is free and needs no login; boosting is
 * a paid option (posting itself is not called free, because platform fees vary by category);
 * listings are checked before they go live but properties are not inspected; brokerage is stated
 * by whoever posted. No counts or figures. India is the default market; the US wording (docs/plans/us-market-expansion.md) drops the claims that
 * depend on India-only setup (listings checked before they go live, paid boosts, phone sign-in). */
import type { MarketId } from "./market";
/** The three "how it works" steps for a market (India unless another is named). */
export declare function homeSteps(marketId?: MarketId): {
    title: string;
    text: string;
}[];
export declare const HOME_STEPS: {
    title: string;
    text: string;
}[];
export interface HomeFaq {
    question: string;
    answer: string;
}
/** `cityNames` are the cities to name in the coverage answer; empty falls back to "across India" (the US says it is starting small instead). */
export declare function homeFaqs(cityNames: string[], marketId?: MarketId): HomeFaq[];
