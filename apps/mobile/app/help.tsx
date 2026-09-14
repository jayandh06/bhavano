import type { ReactNode } from "react";
import { Text } from "react-native";
import { useAppTheme } from "../src/theme/ThemeContext";
import { FaqGroup, type Faq } from "../src/components/home/FaqGroup";
import { P, PageLink, PageSection, StaticPageLayout } from "../src/components/home/StaticPageLayout";

function Bold({ children }: { children: ReactNode }) {
  return <Text style={{ fontWeight: "700" }}>{children}</Text>;
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
        Tap <Bold>Login</Bold> and choose either <Bold>Continue with Google</Bold> or <Bold>Phone OTP</Bold> (we&rsquo;ll
        text you a one-time code). There&rsquo;s no separate signup step — logging in the first time creates your
        account.
      </>
    ),
  },
];

const POSTING: Faq[] = [
  {
    q: "How do I post a free ad?",
    a: (
      <>
        Tap <Bold>Post ad</Bold>, pick a category, then a transaction type (buy/sell/rent/lease, where applicable),
        fill in the details, review, and post. It&rsquo;s free.
      </>
    ),
  },
  {
    q: "What can I list?",
    a: "Houses, apartments, villas, plots, PG/hostel accommodation, storage space, coworking desks, commercial spaces, and furniture — each with its own set of relevant fields (bedrooms, sharing type, seat type, and so on).",
  },
  {
    q: "How long does my ad stay live?",
    a: <>Ads run for 30 days by default. You can also mark a listing Sold/Rented, or deactivate it early, from My listings on the website.</>,
  },
  {
    q: "Can I edit my ad after posting it?",
    a: <>Yes, from My listings on the website — the app can view your listings but editing isn&rsquo;t built into it yet.</>,
  },
  {
    q: "I typed a locality but it's not in the suggestions — what happens?",
    a: "If it's a genuinely new area we don't have on file yet, it gets added automatically once you post — you don't need it to already exist.",
  },
];

const BUYING_RENTING: Faq[] = [
  {
    q: "How do I contact a seller or owner?",
    a: 'Open the listing and use "Message" — it starts a message thread with them, which you can carry on from the Messages tab. You\'ll need to be logged in, and we\'ll ask you to sign in at that point if you aren\'t.',
  },
  {
    q: "Can I save a listing to look at later?",
    a: "Yes — tap the heart on any listing card to favourite it (requires login), then view everything you've saved under Saved listings on your Account tab.",
  },
  {
    q: "Does Bhavano verify listings or sellers?",
    a: (
      <>
        No — Bhavano is a marketplace that connects buyers and sellers directly; we don&rsquo;t verify ownership,
        condition, or legal title of anything listed. Always verify documents and inspect a property or item in
        person before paying anyone. See our <PageLink href="/terms">Terms of Service</PageLink>.
      </>
    ),
  },
];

const ACCOUNT: Faq[] = [
  {
    q: "How do I update my name or city?",
    a: <>Go to your <PageLink href="/account">Account tab</PageLink> — you can update your name and city there.</>,
  },
  {
    q: "Where can I see everything I've posted?",
    a: "My listings, on the website — it shows every ad you've posted, its status (active/sold/rented/deactivated), and view/favourite counts.",
  },
  {
    q: "How do I log out?",
    a: <>Open the <PageLink href="/account">Account tab</PageLink> and scroll to Log out.</>,
  },
];

const SAFETY: Faq[] = [
  {
    q: "How do I report a listing or a user?",
    a: <><PageLink href="/contact">Contact us</PageLink> with a link to the listing (or its title and city) and what's wrong — we'll take a look.</>,
  },
  {
    q: "What data does Bhavano collect about me?",
    a: <>See our <PageLink href="/privacy">Privacy Policy</PageLink> for the full details — in short, your account info, anything you post, and your favourites/messages/views.</>,
  },
];

// Mirrors apps/web/src/app/help/page.tsx, with copy adjusted where the mobile app's own
// navigation differs (tabs instead of a top nav, no in-app listing editor yet) — see
// StaticPageLayout's own note on why this is duplicated rather than loaded from the live page.
export default function HelpScreen() {
  return (
    <StaticPageLayout title="Help centre">
      <FaqGroup title="Getting started" items={GETTING_STARTED} />
      <FaqGroup title="Posting an ad" items={POSTING} />
      <FaqGroup title="Buying & renting" items={BUYING_RENTING} />
      <FaqGroup title="Account & profile" items={ACCOUNT} />
      <FaqGroup title="Trust & safety" items={SAFETY} />

      <PageSection heading="Still need help?">
        <P>
          Can&rsquo;t find your answer here? <PageLink href="/contact">Contact us</PageLink> and we&rsquo;ll help
          you out.
        </P>
      </PageSection>
    </StaticPageLayout>
  );
}
