import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BffAuthError, fetchAreas, fetchCities, fetchConversation, fetchMessages } from "@/lib/bff";
import { buildListingPath } from "@/lib/listingPath";
import { MessageThread } from "@/components/home/MessageThread";
import { resolveDefaultCity } from "@/lib/defaultCity";
import { PageHeader } from "@/components/home/PageHeader";
import { Footer } from "@/components/home/Footer";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.accessToken || !session.user?.id) redirect("/messages");

  let messages;
  let conversation;
  try {
    // In parallel: neither depends on the other, and the thread is behind a login so this is
    // never a cached render anyone waits twice for.
    [messages, conversation] = await Promise.all([
      fetchMessages(session.accessToken, id),
      fetchConversation(session.accessToken, id),
    ]);
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
        {/* A trail, not a back button.
          *
          * There are two ways into this page and the old "← Back to messages" only served one of
          * them: someone who arrived from a listing's "Contact owner" had never seen the messages
          * list, and the one link on the page sent them somewhere they had not been. Getting back
          * to the ad they were asking about took the browser's own back button, or a fresh search.
          *
          * Reading the referrer to decide would be worse — it is absent on a fresh tab, which is
          * exactly how listings open from a card. The conversation knows its listing, so both
          * destinations are simply always there, and the trail reads the same either way. */}
        <nav aria-label="Breadcrumb" className="mb-3 sm:mb-4 shrink-0 flex items-center gap-1.5 text-[13px] min-w-0">
          <Link href="/messages" className="text-muted hover:text-text whitespace-nowrap">
            Messages
          </Link>
          <span aria-hidden className="text-muted">/</span>
          <Link
            href={buildListingPath(conversation.listing)}
            className="text-text font-bold truncate"
            title={conversation.listing.title}
          >
            {conversation.listing.title}
          </Link>
        </nav>
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
