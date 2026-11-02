import Link from "next/link";
import { POST_FEEDBACK_SOURCES, type PostFeedbackSource } from "@bhavano/types/postFeedback";
import { auth } from "@/auth";
import { fetchMyPostFeedback } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { PostFeedbackForm } from "@/components/home/PostFeedbackForm";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export const metadata = {
  title: "How was posting your ad?",
  description: "Tell us how it went posting your ad on Bhavano, and what we should improve.",
  // A personal, logged-in page reached from a message or a notification: never indexed.
  robots: { index: false, follow: false },
};

/** Where the push and in-app feedback requests land (docs/plans/post-ad-experience-feedback.md). `?src=push|in_app_message` says which
 * one brought the owner here; anything else is recorded as a plain web link. A listing that is not theirs shows the error message. */
export default async function PostFeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ listingId }, sp] = await Promise.all([params, searchParams]);
  const srcParam = typeof sp.src === "string" ? sp.src : undefined;
  const source: PostFeedbackSource = POST_FEEDBACK_SOURCES.find((s) => s === srcParam && s !== "success_screen") ?? "web_link";
  const [session, { city, cityAreas, allCities }] = await Promise.all([auth(), resolvePageCityContext(undefined)]);

  let body: React.ReactNode;
  if (!session?.accessToken) {
    body = (
      <RequireLoginPrompt message="Log in to tell us how posting your ad went." redirectTo={`/feedback/post/${encodeURIComponent(listingId)}`} />
    );
  } else {
    try {
      const existing = await fetchMyPostFeedback(session.accessToken, listingId);
      body = <PostFeedbackForm listingId={listingId} source={source} initial={existing} variant="page" />;
    } catch {
      body = <p className="text-sm text-text-soft">We could not open this ad's feedback form. It may belong to a different account.</p>;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <div className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 pb-20">
        <Link href="/my-listings" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to my ads
        </Link>
        <h1 className="font-lora text-2xl font-semibold m-0 mb-5">How was posting your ad?</h1>
        {body}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}
