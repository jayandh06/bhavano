import Link from "next/link";
import { auth } from "@/auth";
import { fetchConversations } from "@/lib/bff";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export default async function MessagesPage() {
  const session = await auth();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px" }}>
        <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 26, fontWeight: 600, margin: "0 0 20px" }}>
          Messages
        </h1>

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to see your conversations." />
        ) : (
          <ConversationList accessToken={session.accessToken} />
        )}
      </div>
    </div>
  );
}

async function ConversationList({ accessToken }: { accessToken: string }) {
  const conversations = await fetchConversations(accessToken);

  if (conversations.length === 0) {
    return <p style={{ color: "var(--muted)", fontSize: 14 }}>No conversations yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {conversations.map((c) => (
        <Link
          key={c.id}
          href={`/messages/${c.id}`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 14,
            color: "inherit",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{c.otherPartyName}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.listingTitle}</div>
            {c.lastMessage && (
              <div style={{ fontSize: 13, color: "var(--text-soft)", marginTop: 4 }}>{c.lastMessage.body}</div>
            )}
          </div>
          {c.unreadCount > 0 && (
            <span
              style={{
                background: "var(--green)",
                color: "var(--on-green)",
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 8px",
              }}
            >
              {c.unreadCount}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
