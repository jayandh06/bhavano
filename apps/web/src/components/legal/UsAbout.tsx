import Link from "next/link";
import { LEGAL_ENTITY, entityAddressLines, entityOperatorSentence } from "@bhavano/types/legalEntity";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";

/** The US About page. India's (app/about/page.tsx) names India, plots, PG and coworking, and links the India moving guide. */
export function UsAbout() {
  const addressLines = entityAddressLines();

  return (
    <StaticPageLayout title="About us" updated="26 November 2026">
      <PageSection heading="Who we are">
        <p className="m-0">
          {entityOperatorSentence()} Bhavano is a classifieds marketplace where people browse, post, rent, buy and sell homes, condos,
          townhouses, rooms, storage space and commercial space across the United States, with no login needed to browse.
        </p>
      </PageSection>

      <PageSection heading="How it works">
        <p className="m-0">
          Owners and agents post their own listings, and you message them directly on Bhavano. We are not a broker and we are not a party to
          any rental or sale.{" "}
          <Link href="/trust" className="text-green font-bold">
            Trust &amp; Safety
          </Link>{" "}
          explains what we do and do not check.
        </p>
      </PageSection>

      <PageSection heading="Legal entity">
        <ul className="list-none m-0 p-0 flex flex-col gap-1">
          <li>
            <span className="text-muted">Operator: </span>
            <span className="text-text font-bold">{LEGAL_ENTITY.legalName}</span>
          </li>
          <li>
            <span className="text-muted">Brand: </span>
            <span className="text-text">{LEGAL_ENTITY.brand} (bhavano.com and the Bhavano mobile app)</span>
          </li>
        </ul>
      </PageSection>

      {addressLines.length > 0 && (
        <PageSection heading="Registered office">
          <address className="not-italic m-0">
            {addressLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </address>
        </PageSection>
      )}

      <PageSection heading="Contact">
        <p className="m-0">
          Email us at{" "}
          <a href={`mailto:${LEGAL_ENTITY.supportEmail}`} className="text-green font-bold">
            {LEGAL_ENTITY.supportEmail}
          </a>
          . For anything else, see our{" "}
          <Link href="/contact" className="text-green font-bold">
            Contact page
          </Link>{" "}
          or the{" "}
          <Link href="/help" className="text-green font-bold">
            Help center
          </Link>
          .
        </p>
      </PageSection>

      <PageSection heading="Legal">
        <p className="m-0">
          Read our{" "}
          <Link href="/terms" className="text-green font-bold">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-green font-bold">
            Privacy Policy
          </Link>
          .
        </p>
      </PageSection>
    </StaticPageLayout>
  );
}
