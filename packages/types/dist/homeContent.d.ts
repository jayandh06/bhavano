/** Text shared by the website's homepage sections and the app's end-of-feed section, so the two
 * can never say different things about how Bhavano works. See docs/plans/homepage-seo-aeo-structure.md.
 *
 * Only claims that are already true on the site: browsing is free and needs no login; boosting is
 * a paid option (posting itself is not called free, because platform fees vary by category);
 * listings are checked before they go live but properties are not inspected; brokerage is stated
 * by whoever posted. No counts or figures. */
export declare const HOME_STEPS: {
    title: string;
    text: string;
}[];
export interface HomeFaq {
    question: string;
    answer: string;
}
/** `cityNames` are the cities to name in the coverage answer; empty falls back to "across India". */
export declare function homeFaqs(cityNames: string[]): HomeFaq[];
