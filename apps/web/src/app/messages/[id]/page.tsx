import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BffAuthError, fetchAreas, fetchCities, fetchMessages } from "@/lib/bff";
import { MessageThread } from "@/components/home/MessageThread";
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

  // Same city context the messages list and every other static page feed their footer, so the
  // footer's city/area links are not generic here.
  const allCities = await fetchCities(undefined, true);
  const city = allCities.find((c) => c.isPopular) ?? allCities[0];
  const cityAreas = city ? await fetchAreas(city.id, undefined, true) : [];

  return (
    // flex flex-col + flex-1 below, matching the listings pages: without it the footer rides up
    // under short content instead of sitting at the bottom.
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader />
      <div className="flex-1 w-full max-w-[1280px] mx-auto p-8">
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
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}
