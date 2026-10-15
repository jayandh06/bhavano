import Link from "next/link";
import type { Metadata } from "next";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";
import { JsonLd } from "@/components/JsonLd";
import { faqPageJsonLd } from "@/lib/faqJsonLd";

const TITLE = "Trust & listing standards";
const DESCRIPTION =
  "How Bhavano keeps listings clean: automated checks before a listing goes live, human review and takedown, and what we don't verify yet.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/trust" },
};

/** Every statement on this page describes something the product does today (ModerationService's
 * pre-publish checks, admin review and flagging, login to post). Don't add numbers or promises
 * here that the code and the admin tools can't back — an unverifiable claim on a page about trust
 * is worse than no page. When verification metrics exist (listings removed, response times), add
 * them from real data. */
const FAQS: { q: string; a: string }[] = [
  {
    q: "Are listings on Bhavano verified?",
    a: "Every listing goes through automated checks before it goes live, and our team reviews and can take down listings that break the standards. We do not physically inspect properties, and we do not currently verify ownership of every listing.",
  },
  {
    q: "What happens to a listing that breaks the rules?",
    a: "Our team can flag it. A flagged listing is hidden from search and browse straight away, and the owner is messaged inside Bhavano with what needs fixing. It goes back live only after it's corrected and approved.",
  },
  {
    q: "Can someone post the same photos as another seller?",
    a: "Photos are compared against other sellers' photos in the same city before a listing is published. A photo that matches another seller's is rejected, and the owner is told which photo to replace.",
  },
  {
    q: "How do I report a suspicious listing?",
    a: "Use the Contact us page with a link to the listing and what looks wrong. We review reports and act on listings that break the standards.",
  },
];

export default function TrustPage() {
  return (
    <StaticPageLayout title={TITLE} updated="15 October 2026">
      <JsonLd data={faqPageJsonLd(FAQS)} />

      <PageSection heading="Our standard">
        <p className="m-0">
          Bhavano is a marketplace for homes, PG accommodation, coworking, storage and commercial space, and
          for the furniture that goes with them. We want a listing here to be real, current and clearly
          described. This page sets out what we check, what happens when a listing falls short, and what we
          do not do yet.
        </p>
      </PageSection>

      <PageSection heading="Checks before a listing goes live">
        <ul className="m-0 pl-5 flex flex-col gap-1.5">
          <li>
            <strong className="text-text">Sign-in to post.</strong> Posting needs a Google account or a phone
            number confirmed with a one-time code. Browsing doesn&apos;t.
          </li>
          <li>
            <strong className="text-text">Banned content.</strong> Listings are scanned for words and phrases
            that aren&apos;t allowed.
          </li>
          <li>
            <strong className="text-text">Price sense-check.</strong> Prices that are implausible for the
            category are stopped before publishing.
          </li>
          <li>
            <strong className="text-text">Duplicate photos.</strong> Photos are compared with other sellers&apos;
            photos in the same city. Re-using someone else&apos;s pictures is rejected, and the seller is told
            which photo to replace.
          </li>
        </ul>
      </PageSection>

      <PageSection heading="Review and takedown">
        <p className="m-0">
          Our team reviews listings and can flag any that break these standards. A flagged listing is hidden
          from search and browse immediately, and the owner receives a message in their Bhavano inbox saying
          what to fix. After they edit it, it returns to the review queue, and it goes live again once
          approved.
        </p>
      </PageSection>

      <PageSection heading="Keeping listings current">
        <p className="m-0">
          Owners control their own listing&apos;s status: active, sold, rented or deactivated. A listing stays
          up until its owner closes it, so we encourage owners to mark a property sold or rented once it&apos;s
          gone.
        </p>
      </PageSection>

      <PageSection heading="What we don't do yet">
        <ul className="m-0 pl-5 flex flex-col gap-1.5">
          <li>We don&apos;t visit or inspect properties.</li>
          <li>We don&apos;t independently verify ownership documents for every listing.</li>
          <li>We aren&apos;t a broker and aren&apos;t party to any deal between buyer and seller.</li>
        </ul>
        <p className="m-0 mt-2">
          Meet in person, see the property, and don&apos;t pay anyone before you have. If you see something that
          doesn&apos;t look right, tell us.
        </p>
      </PageSection>

      <PageSection heading="Report a listing">
        <p className="m-0">
          <Link href="/contact" className="text-green font-bold">
            Contact us
          </Link>{" "}
          with a link to the listing and what looks wrong. You can also read the{" "}
          <Link href="/help" className="text-green font-bold">
            Help Centre
          </Link>{" "}
          and our{" "}
          <Link href="/about" className="text-green font-bold">
            About page
          </Link>{" "}
          for who runs Bhavano.
        </p>
      </PageSection>
    </StaticPageLayout>
  );
}
