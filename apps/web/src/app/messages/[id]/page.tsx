import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BffAuthError, fetchAreas, fetchCities, fetchMessages } from "@/lib/bff";
import { MessageThread } from "@/components/home/MessageThread";
import { resolveDefaultCity } from "@/lib/defaultCity";
import { PageHeader } from "@/components/home/PageHeader";
import { Footer } from "@/components/home/Footer";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.accessToken || !session.user?.id) redirect("/messages");

  let messages;
  try {
    messages = await fetchMessages(session.accessToken, id);
  } catch (error) {
    if (error instanceof BffAuthError) redirect("/messages");
    throw error;
  }

  // Whichever city the reader last chose — not "the first popular city the API happens to
  // return", which is what this used to do and which shows a genuinely arbitrary place to
  // someone who never picked it. Undefined means they have not chosen one, and the footer falls
  // back to its plain city list rather than inventing an answer.
  const allCities = await fetchCities(undefined, true);
  const city = await resolveDefaultCity(allCities);
  const cityAreas = city ? await fetchAreas(city.id, undefined, true) : [];

  return (
    // Exactly one viewport tall on a phone, and taller than one on desktop.
    //
    // `min-h-screen` on both was what buried the composer: the header, the back link, a 70vh
    // thread and a footer full of city links add up to well over a screen, so on a phone the
    // page scrolled and the text box — the only thing you came here to use — started below the
    // fold. `h-dvh` instead makes the shell the exact height of the viewport, so nothing can
    // push the composer off it; the message list is then the one part that scrolls. `dvh`
    // rather than `vh` because mobile Safari's `vh` is the height with the address bar hidden,
    // which is taller than what you can actually see.
    //
    // Every box between here and the composer needs `min-h-0`: a flex item defaults to
    // `min-height: auto`, which refuses to shrink below its content, and one such box anywhere
    // in the chain pushes the overflow back out to the page and restores the original bug.
    //
    // flex flex-col + flex-1 matches the listings pages: without it the footer rides up under
    // short content instead of sitting at the bottom.
    <div className="h-dvh sm:h-auto sm:min-h-screen flex flex-col bg-bg text-text">
      <PageHeader />
      <div className="flex-1 min-h-0 w-full max-w-[1280px] mx-auto p-4 sm:p-8 flex flex-col">
        <Link href="/messages" className="text-[13px] text-muted mb-3 sm:mb-4 inline-block shrink-0">
          ← Back to messages
        </Link>
        <MessageThread
          conversationId={id}
          accessToken={session.accessToken}
          currentUserId={session.user.id}
          initialMessages={messages}
        />
      </div>
      {/* A chat fills the phone screen, so there is nowhere to put a footer that would not mean
          scrolling the composer away again. Desktop has the room and keeps it. */}
      <div className="hidden sm:block">
        <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
      </div>
    </div>
  );
}
