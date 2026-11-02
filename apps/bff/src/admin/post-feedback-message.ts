import type { FeedbackRequestMessageCardDto } from '@bhavano/types';

/** The in-app "How was posting your ad?" message — docs/plans/post-ad-experience-feedback.md. Same two-part shape as the Boost message
 * (boost-message.ts): a card that current web builds draw with the cover photo and a button, and a plain-text body whose first sentence
 * is the push preview and which older app builds show as it is. Both are built from the same sentences so they cannot drift apart. */
export const POST_FEEDBACK_REQUEST_KIND = 'post_feedback_request';

export interface PostFeedbackMessageInput {
  /** The ad's title, quoted so the owner knows which ad it is about. */
  title: string;
  /** "Area, City". */
  location: string;
  /** `${site}${postFeedbackRequestPath(listingId)}`. */
  link: string;
}

/** Where the button (and the plain-text link) goes: the feedback page for this ad, tagged so the answer records how it was reached. */
export function postFeedbackRequestPath(listingId: string): string {
  return `/feedback/post/${listingId}?src=in_app_message`;
}

const PARAGRAPH = 'Tell us what was easy, what was hard and what we should change. It takes less than half a minute and your ad stays live either way.';

export function buildPostFeedbackBody({ title, link }: PostFeedbackMessageInput): string {
  return [`How was posting "${title}"? Your answer helps us make posting easier.`, PARAGRAPH, `Share feedback: ${link}`].join('\n\n');
}

export function buildPostFeedbackCard(
  input: PostFeedbackMessageInput,
  listing: { id: string; imageUrl: string | null },
): FeedbackRequestMessageCardDto {
  return {
    kind: 'feedback_request',
    listingId: listing.id,
    title: input.title,
    location: input.location,
    imageUrl: listing.imageUrl,
    headline: 'How was posting this ad?',
    paragraphs: [PARAGRAPH],
    ctaLabel: 'Share feedback',
    ctaPath: postFeedbackRequestPath(listing.id),
  };
}
