/** Shared contract for the post-ad experience feedback — see docs/plans/post-ad-experience-feedback.md.
 * The web form, the BFF DTO and the admin screen all read these, so a difficulty chip cannot drift between them. */
/** What was hard. Named after the steps of the post-ad flow, in the order a poster meets them. */
export declare const POST_FEEDBACK_DIFFICULTIES: readonly ["category", "photos", "details", "price", "location", "preview", "payment", "login", "other"];
export type PostFeedbackDifficulty = (typeof POST_FEEDBACK_DIFFICULTIES)[number];
export declare const POST_FEEDBACK_DIFFICULTY_LABELS: Record<PostFeedbackDifficulty, string>;
/** How the request reached the poster, kept so response rates can be compared per surface. */
export declare const POST_FEEDBACK_SOURCES: readonly ["success_screen", "in_app_message", "push", "web_link"];
export type PostFeedbackSource = (typeof POST_FEEDBACK_SOURCES)[number];
export declare const POST_FEEDBACK_SOURCE_LABELS: Record<PostFeedbackSource, string>;
export declare const POST_FEEDBACK_MAX_SUGGESTION = 500;
/** What a poster has already told us about one listing (null fields are simply unanswered). */
export interface PostFeedbackDto {
    listingId: string;
    rating: number | null;
    difficulties: PostFeedbackDifficulty[];
    suggestion: string | null;
    canContact: boolean;
}
/** Body of POST /feedback/post. Every answer is optional except the listing: tapping a star alone is a valid save, and a later
 * call updates the same row. A field left out is left as it was. */
export interface SavePostFeedbackRequest {
    listingId: string;
    rating?: number;
    difficulties?: PostFeedbackDifficulty[];
    suggestion?: string;
    canContact?: boolean;
    source?: PostFeedbackSource;
    /** "web" or "app", from the client; the BFF also reads `x-client`. */
    platform?: string;
    appVersion?: string;
}
/** One row on the admin Feedback screen. */
export interface AdminPostFeedbackRowDto {
    id: string;
    createdAt: string;
    updatedAt: string;
    rating: number | null;
    difficulties: PostFeedbackDifficulty[];
    suggestion: string | null;
    canContact: boolean;
    source: PostFeedbackSource;
    platform: string | null;
    appVersion: string | null;
    category: string;
    transactionType: string;
    listingId: string;
    listingTitle: string;
    userId: string;
    userName: string | null;
    userPhone: string | null;
    userEmail: string | null;
}
export interface AdminPostFeedbackPage {
    items: AdminPostFeedbackRowDto[];
    total: number;
    /** Over every row matching the filters, not just this page. */
    summary: {
        answered: number;
        averageRating: number | null;
        /** Count of 1 to 5 star answers, index 0 is one star. */
        ratingCounts: number[];
        /** How many answers named each difficulty, most named first. */
        difficultyCounts: {
            difficulty: PostFeedbackDifficulty;
            count: number;
        }[];
        withSuggestion: number;
        canContact: number;
    };
}
