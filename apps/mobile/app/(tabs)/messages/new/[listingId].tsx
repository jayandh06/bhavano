import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useHomeSheets } from "../../../../src/context/HomeSheetsProvider";
import { fetchListingById } from "../../../../src/lib/bffClient";
import { ConversationThread } from "../../../../src/components/home/ConversationThread";

/** The pre-send counterpart to [id].tsx — reached from "Contact owner" before any Conversation
 * row exists (see docs/plans/message-delete-and-lazy-conversation-creation.md). No message
 * history to wait for (there is none yet), so this renders the thread immediately; the listing
 * title populates a beat later, same best-effort pattern [id].tsx uses for its own listing bar. */
export default function NewConversationScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { accessToken, userId } = useHomeSheets();
  const [listingTitle, setListingTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchListingById(listingId, accessToken)
      .then((listing) => {
        if (!cancelled) setListingTitle(listing.title);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [listingId, accessToken]);

  return (
    <ConversationThread
      conversationId={null}
      listingId={listingId}
      listingTitle={listingTitle}
      accessToken={accessToken}
      userId={userId}
      initialMessages={[]}
    />
  );
}
