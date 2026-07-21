import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BffAuthError, fetchMessages } from "@/lib/bff";
import { MessageThread } from "@/components/home/MessageThread";
import { PageHeader } from "@/components/home/PageHeader";

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

  return (
    <div className="min-h-screen bg-bg text-text">
      <PageHeader />
      <div className="max-w-[720px] mx-auto p-8">
        <Link href="/messages" className="text-[13px] text-muted mb-4 inline-block">
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
