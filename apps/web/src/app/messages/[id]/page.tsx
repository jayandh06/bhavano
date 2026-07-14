import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchMessages } from "@/lib/bff";
import { MessageThread } from "@/components/home/MessageThread";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.accessToken || !session.user?.id) redirect("/messages");

  const messages = await fetchMessages(session.accessToken, id);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px" }}>
        <Link href="/messages" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to messages
        </Link>
        <MessageThread
          conversationId={id}
          accessToken={session.accessToken}
          currentUserId={session.user.id}
          initialMessages={messages}
        />
      </div>
    </div>
  );
}
