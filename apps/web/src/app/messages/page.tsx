import Link from "next/link";
import { formatUnreadCount } from "@bhavano/types/unreadCount";
import { auth } from "@/auth";
import { BffAuthError, fetchConversations } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";
import { Icon } from "@/components/home/Icon";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const citySlug = typeof sp.city === "string" ? sp.city : undefined;
  const [session, { city, cityAreas, allCities }] = await Promise.all([auth(), resolvePageCityContext(citySlug)]);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <div className="flex-1 w-full max-w-[1280px] mx-auto p-8">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-5">Messages</h1>

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to see your conversations." />
        ) : (
          <ConversationList accessToken={session.accessToken} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

/** dd/mm/yyyy hh:mm:ss, in the viewer's local time zone — an explicit absolute timestamp rather
 * than a relative "3h ago", so two messages days apart are still trivially comparable. */
function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function ConversationList({ accessToken }: { accessToken: string }) {
  let conversations;
  try {
    conversations = await fetchConversations(accessToken);
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <RequireLoginPrompt message="Log in to see your conversations." />;
    }
    throw error;
  }

  if (conversations.length === 0) {
    return <p className="text-muted text-sm">No conversations yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {conversations.map((c) => {
        const hasUnread = c.unreadCount > 0;
        return (
          <Link
            key={c.id}
            href={`/messages/${c.id}`}
            className="flex items-center gap-3 border border-border rounded-[10px] p-3.5 text-inherit"
          >
            {/* Filled/green once there's anything unread, outline/muted once the thread is fully
              * read — a glance at the icon says which, without needing the count badge too. */}
            <span
              className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-full ${
                hasUnread ? "bg-green text-on-green" : "bg-surface-alt text-muted"
              }`}
            >
              <Icon name="message" filled={hasUnread} />
            </span>
            <div className="min-w-0 flex-1">
              {/* The other participant's name/phone never renders here — see
                * MessagingService.listConversations' own note on why: this app makes its money on
                * a *paid* contact reveal, so a free-to-read messages list can't be the place that
                * hands out who someone is. The listing is what the thread is about either way. */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-sm">{c.listingTitle}</span>
                {c.otherPartyIsVerifiedBuyer && (
                  <span className="text-[10.5px] font-bold text-green border border-green rounded-md px-1.5 py-[1px] whitespace-nowrap">
                    <Icon name="check" /> Verified Buyer
                  </span>
                )}
              </div>
              {/* Where and when, on one line — the listing's locality (the same "which one" cue
                * the title alone doesn't give when someone has more than one live ad) and the
                * last message's time, the two things worth a glance before opening the thread. */}
              <div className="text-[11.5px] text-muted mt-0.5 truncate">
                {c.listingArea}, {c.listingCityName}
                {c.lastMessage && ` · ${formatMessageTime(c.lastMessage.createdAt)}`}
              </div>
              {/* Every listed conversation has at least one message now (see
                  MessagingService.listConversations' `messages: { some: {} } }` filter) — a
                  Conversation row can no longer exist without one — but lastMessage stays
                  nullable in the DTO, so this defensive fallback is kept rather than assumed
                  away. */}
              {c.lastMessage ? (
                <div className="text-[13px] text-text-soft mt-1 truncate">
                  {c.lastMessage.deletedAt ? (
                    <span className="italic">This message was deleted</span>
                  ) : (
                    c.lastMessage.body
                  )}
                </div>
              ) : (
                <div className="text-[13px] text-muted italic mt-1">No messages yet</div>
              )}
            </div>
            {hasUnread && (
              <span className="shrink-0 bg-green text-on-green rounded-full text-[11px] font-bold px-2 py-[3px]">
                {formatUnreadCount(c.unreadCount)}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
