import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchAreas, fetchCities, fetchListingMeta } from "@/lib/bff";
import { buildListingPath } from "@/lib/listingPath";
import { MessageThread } from "@/components/home/MessageThread";
import { resolveDefaultCity } from "@/lib/defaultCity";
import { PageHeader } from "@/components/home/PageHeader";
import { Footer } from "@/components/home/Footer";
import { Icon } from "@/components/home/Icon";

/** The pre-send counterpart to /messages/[id] — reached from "Contact owner" before any
 * Conversation row exists (see docs/plans/message-delete-and-lazy-conversation-creation.md).
 * Same shell as the real thread page, but the listing bar comes from the public
 * fetchListingMeta (no conversation to read it off yet), there is no message history to fetch,
 * and MessageThread itself creates the conversation atomically with the first send. */
export default async function NewConversationPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const session = await auth();
  if (!session?.accessToken || !session.user?.id) redirect("/messages");

  // fetchListingMeta is public/unauthenticated, so it can never 401 (no BffAuthError to special-
  // case here the way /messages/[id]/page.tsx does) — a bad/removed listingId (rare, the link
  // came from a live listing page moments earlier) is left to surface as the generic error page.
  const listing = await fetchListingMeta(listingId);

  const allCities = await fetchCities(undefined, true);
  const city = await resolveDefaultCity(allCities);
  const cityAreas = city ? await fetchAreas(city.id, undefined, true) : [];

  return (
    // See /messages/[id]/page.tsx's own comment for why h-dvh + min-h-0 all the way down.
    <div className="h-dvh sm:h-auto sm:min-h-screen flex flex-col bg-bg text-text">
      <PageHeader />
      <div className="flex-1 min-h-0 w-full max-w-[1280px] mx-auto p-4 sm:p-8 flex flex-col">
        <nav aria-label="Breadcrumb" className="mb-3 sm:mb-4 shrink-0 flex items-center gap-1.5 text-[13px] min-w-0">
          <Link href="/messages" className="text-muted hover:text-text whitespace-nowrap">
            Messages
          </Link>
          <span aria-hidden className="text-muted">/</span>
          <Link
            href={buildListingPath(listing)}
            className="text-green font-bold truncate hover:underline inline-flex items-center gap-1 min-w-0"
            title={listing.title}
          >
            <span className="truncate">{listing.title}</span>
            <Icon name="chevronRight" className="shrink-0 text-[11px]" />
          </Link>
        </nav>
        <MessageThread
          conversationId={null}
          listingId={listingId}
          accessToken={session.accessToken}
          currentUserId={session.user.id}
          initialMessages={[]}
        />
      </div>
      <div className="hidden sm:block">
        <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
      </div>
    </div>
  );
}
