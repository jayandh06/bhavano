import Link from "next/link";
import type { Metadata } from "next";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";
import { JsonLd } from "@/components/JsonLd";
import { faqPageJsonLd } from "@/lib/faqJsonLd";
import { buildBrowsePath } from "@/lib/listingPath";

const TITLE = "Moving to a new city in India: a practical checklist";
const DESCRIPTION =
  "A step-by-step checklist for moving city: choose between a PG and a rented flat, set up a workspace, store what you can't take yet, and avoid common rental mistakes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/moving-to-a-new-city" },
};

// Built with the same helper the rest of the site uses, so these can never drift from the real
// browse routes. This page is general advice only: no prices, rents or statistics, because none
// of them would be ours to stand behind.
const PG = buildBrowsePath({ transactionGroup: "rent-lease", category: "pg" });
const FLATS = buildBrowsePath({ transactionGroup: "rent-lease", category: "apartment" });
const COWORKING = buildBrowsePath({ transactionGroup: "rent-lease", category: "coworking" });
const STORAGE = buildBrowsePath({ transactionGroup: "rent-lease", category: "storage" });
const COMMERCIAL = buildBrowsePath({ transactionGroup: "rent-lease", category: "commercial" });

const FAQS: { q: string; a: string }[] = [
  {
    q: "Should I take a PG or rent a flat when I move to a new city?",
    a: "A PG is quicker and cheaper to start, usually furnished with meals and a short notice period, which suits the first few months in a city you don't know. A rented flat gives more privacy and control, and works better once you know which area and commute suit you. Many people start in a PG and move to a flat later.",
  },
  {
    q: "How far ahead should I start looking?",
    a: "Start two to four weeks before you move. That is long enough to shortlist areas and see places in person, and short enough that listings are still current when you arrive.",
  },
  {
    q: "Should I pay a deposit before seeing the property?",
    a: "No. See the property in person, check the owner or agent's details, and get the terms in writing before paying a deposit or advance.",
  },
  {
    q: "Where can I store belongings between leaving one home and settling into another?",
    a: "A storage space in your new city holds furniture and boxes while you wait for a flat or a longer lease. You can look for storage space on Bhavano alongside homes and PG listings.",
  },
];

export default function MovingToANewCityPage() {
  return (
    <StaticPageLayout title={TITLE} updated="15 October 2026">
      <JsonLd data={faqPageJsonLd(FAQS)} />

      <PageSection heading="Start here">
        <p className="m-0">
          Moving to a new city for work, study or a fresh start means solving several problems at once: where
          to live, where to work, what to do with your things, and how not to get caught out. This checklist
          takes them in the order most people meet them. It is general advice, not a promise about any
          listing or price.
        </p>
      </PageSection>

      <PageSection heading="1. Two to four weeks before you move">
        <ul className="m-0 pl-5 flex flex-col gap-1.5">
          <li>Pick two or three areas by commute to work or college, not by rent alone.</li>
          <li>
            Set a monthly budget for rent, deposit, food and travel. The{" "}
            <Link href="/tools/rent-affordability-calculator" className="text-green font-bold">
              rent affordability calculator
            </Link>{" "}
            helps with the rent part.
          </li>
          <li>
            Browse the{" "}
            <Link href="/cities" className="text-green font-bold">
              city list
            </Link>{" "}
            to see which of your shortlisted areas have listings.
          </li>
        </ul>
      </PageSection>

      <PageSection heading="2. Choose where to stay first">
        <p className="m-0">
          For the first weeks, <Link href={PG} className="text-green font-bold">a PG</Link> is often the
          simplest start: quick to move into, usually furnished, with a short notice period. If you want
          privacy, a family home or a longer stay,{" "}
          <Link href={FLATS} className="text-green font-bold">a rented flat</Link> fits better. Many people
          start in a PG and move to a flat once they know the city.
        </p>
      </PageSection>

      <PageSection heading="3. Set up somewhere to work">
        <p className="m-0">
          Working remotely, freelancing or starting a small business? A{" "}
          <Link href={COWORKING} className="text-green font-bold">coworking desk or cabin</Link> avoids a long
          lease while you find your feet. If you need a shop or an office of your own, look at{" "}
          <Link href={COMMERCIAL} className="text-green font-bold">commercial space</Link>.
        </p>
      </PageSection>

      <PageSection heading="4. Keep your belongings safe in between">
        <p className="m-0">
          If your furniture arrives before your flat is ready, or you are leaving things behind for now, a{" "}
          <Link href={STORAGE} className="text-green font-bold">storage space</Link> in the new city gives you
          time to decide without paying for a home you don&apos;t need yet.
        </p>
      </PageSection>

      <PageSection heading="5. Before you pay anything">
        <ul className="m-0 pl-5 flex flex-col gap-1.5">
          <li>See the place in person, or send someone you trust to see it.</li>
          <li>Check who you are dealing with: the owner, or an agent acting for the owner.</li>
          <li>Get the rent, deposit, notice period and what&apos;s included in writing.</li>
          <li>Don&apos;t pay a deposit or advance before you have seen the property.</li>
          <li>Photos should match what you see. If they don&apos;t, walk away and report the listing.</li>
        </ul>
        <p className="m-0 mt-2">
          Read{" "}
          <Link href="/trust" className="text-green font-bold">
            how Bhavano checks listings
          </Link>
          , including what we don&apos;t verify, and use the{" "}
          <Link href="/contact" className="text-green font-bold">
            Contact us
          </Link>{" "}
          page to report a listing that looks wrong.
        </p>
      </PageSection>

      <PageSection heading="Common questions">
        <ul className="list-none m-0 p-0 flex flex-col gap-3">
          {FAQS.map((f) => (
            <li key={f.q}>
              <strong className="text-text">{f.q}</strong>
              <p className="m-0 mt-1">{f.a}</p>
            </li>
          ))}
        </ul>
      </PageSection>
    </StaticPageLayout>
  );
}
