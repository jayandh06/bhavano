import Link from "next/link";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";

export const metadata = {
  title: "Help Centre — Bhavano",
  description: "Answers to common questions about posting, browsing, and managing listings on Bhavano.",
};

interface Faq {
  q: string;
  a: React.ReactNode;
}

const GETTING_STARTED: Faq[] = [
  {
    q: "Do I need an account to browse listings?",
    a: "No — browsing and searching listings is open to everyone. You only need to log in to post an ad, favourite a listing, or message a seller.",
  },
  {
    q: "How do I create an account?",
    a: (
      <>
        Click <strong>Login</strong> and choose either <strong>Phone OTP</strong> (we&apos;ll text you a one-time
        code) or <strong>Continue with Google</strong>. There&apos;s no separate signup step — logging in the first
        time creates your account.
      </>
    ),
  },
];

const POSTING: Faq[] = [
  {
    q: "How do I post a free ad?",
    a: (
      <>
        Click <strong>+ Post free ad</strong>, pick a category, then a transaction type (buy/sell/rent/lease, where
        applicable), fill in the details, review, and post. It&apos;s free.
      </>
    ),
  },
  {
    q: "What can I list?",
    a: "Houses, apartments, PG/hostel accommodation, storage space, coworking desks, and furniture — each with its own set of relevant fields (bedrooms, sharing type, seat type, and so on).",
  },
  {
    q: "How long does my ad stay live?",
    a: (
      <>
        Ads run for 30 days by default. You can also mark a listing Sold/Rented, or deactivate it early, from{" "}
        <Link href="/my-listings" className="text-green font-bold">
          My listings
        </Link>
        .
      </>
    ),
  },
  {
    q: "Can I edit my ad after posting it?",
    a: (
      <>
        Yes. Open{" "}
        <Link href="/my-listings" className="text-green font-bold">
          My listings
        </Link>{" "}
        and click <strong>Edit</strong> on any listing to change the price, title, specs, category details, or
        status.
      </>
    ),
  },
  {
    q: "I typed a locality but it's not in the suggestions — what happens?",
    a: "If it's a genuinely new area we don't have on file yet, it gets added automatically once you post — you don't need it to already exist.",
  },
];

const BUYING_RENTING: Faq[] = [
  {
    q: "How do I contact a seller or owner?",
    a: 'Open the listing and use "Contact owner" to start a message, or "Call" if a phone number is available. You\'ll need to be logged in to do either.',
  },
  {
    q: "Can I save a listing to look at later?",
    a: (
      <>
        Yes — tap the ♡ on any listing card to favourite it (requires login), then view everything you&apos;ve
        saved under{" "}
        <Link href="/favourites" className="text-green font-bold">
          Favourites
        </Link>
        .
      </>
    ),
  },
  {
    q: "Does Bhavano verify listings or sellers?",
    a: (
      <>
        No — Bhavano is a marketplace that connects buyers and sellers directly; we don&apos;t verify ownership,
        condition, or legal title of anything listed. Always verify documents and inspect a property or item in
        person before paying anyone. See our{" "}
        <Link href="/terms" className="text-green font-bold">
          Terms of Service
        </Link>
        .
      </>
    ),
  },
];

const ACCOUNT: Faq[] = [
  {
    q: "How do I update my name or city?",
    a: (
      <>
        Go to your{" "}
        <Link href="/profile" className="text-green font-bold">
          profile page
        </Link>
        . We can auto-detect your city from your browser&apos;s location, but it&apos;s only ever a suggestion to
        review — it&apos;s never saved without you clicking Save.
      </>
    ),
  },
  {
    q: "Where can I see everything I've posted?",
    a: (
      <>
        <Link href="/my-listings" className="text-green font-bold">
          My listings
        </Link>{" "}
        — it shows every ad you&apos;ve posted, its status (active/sold/rented/deactivated), and view/favourite
        counts.
      </>
    ),
  },
  {
    q: "How do I log out?",
    a: "Click your name in the top-right corner and choose Logout.",
  },
];

const SAFETY: Faq[] = [
  {
    q: "How do I report a listing or a user?",
    a: (
      <>
        <Link href="/contact" className="text-green font-bold">
          Contact us
        </Link>{" "}
        with a link to the listing (or its title and city) and what&apos;s wrong — we&apos;ll take a look.
      </>
    ),
  },
  {
    q: "What data does Bhavano collect about me?",
    a: (
      <>
        See our{" "}
        <Link href="/privacy" className="text-green font-bold">
          Privacy Policy
        </Link>{" "}
        for the full details — in short, your account info, anything you post, and your favourites/messages/views.
      </>
    ),
  },
];

function FaqGroup({ title, items }: { title: string; items: Faq[] }) {
  return (
    <PageSection heading={title}>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <details key={item.q} className="border border-border rounded-[10px] px-4 py-3 bg-surface">
            <summary className="font-bold text-sm text-text cursor-pointer">{item.q}</summary>
            <div className="mt-2.5 text-sm leading-[1.6] text-text-soft">{item.a}</div>
          </details>
        ))}
      </div>
    </PageSection>
  );
}

export default function HelpPage() {
  return (
    <StaticPageLayout title="Help centre">
      <FaqGroup title="Getting started" items={GETTING_STARTED} />
      <FaqGroup title="Posting an ad" items={POSTING} />
      <FaqGroup title="Buying & renting" items={BUYING_RENTING} />
      <FaqGroup title="Account & profile" items={ACCOUNT} />
      <FaqGroup title="Trust & safety" items={SAFETY} />

      <PageSection heading="Still need help?">
        <p className="m-0">
          Can&apos;t find your answer here?{" "}
          <Link href="/contact" className="text-green font-bold">
            Contact us
          </Link>{" "}
          and we&apos;ll help you out.
        </p>
      </PageSection>
    </StaticPageLayout>
  );
}
