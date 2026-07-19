import Link from "next/link";
import { auth } from "@/auth";
import { fetchConversations } from "@/lib/bff";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export default async function MessagesPage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-bg text-text">
      <PageHeader />
      <div className="max-w-[720px] mx-auto p-8">
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
      <Footer />
    </div>
  );
}

async function ConversationList({ accessToken }: { accessToken: string }) {
  const conversations = await fetchConversations(accessToken);

  if (conversations.length === 0) {
    return <p className="text-muted text-sm">No conversations yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {conversations.map((c) => (
        <Link
          key={c.id}
          href={`/messages/${c.id}`}
          className="flex justify-between items-center border border-border rounded-[10px] p-3.5 text-inherit"
        >
          <div>
            <div className="font-bold text-sm">{c.otherPartyName}</div>
            <div className="text-xs text-muted">{c.listingTitle}</div>
            {c.lastMessage && <div className="text-[13px] text-text-soft mt-1">{c.lastMessage.body}</div>}
          </div>
          {c.unreadCount > 0 && (
            <span className="bg-green text-on-green rounded-full text-[11px] font-bold px-2 py-[3px]">{c.unreadCount}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
