import Link from "next/link";
import { LEGAL_ENTITY, entityAddressLines, entityOperatorSentence } from "@bhavano/types/legalEntity";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";

export const metadata = {
  title: "About Us — Bhavano",
  description: `Bhavano is a real estate classifieds marketplace owned and operated by ${LEGAL_ENTITY.legalName}.`,
};

export default function AboutPage() {
  const addressLines = entityAddressLines();

  return (
    <StaticPageLayout title="About us" updated="26 August 2026">
      <PageSection heading="Who we are">
        <p className="m-0">
          {entityOperatorSentence()} Bhavano is a classifieds marketplace where people browse, post, buy, sell, rent
          or lease houses, apartments, villas, plots, PG accommodation, storage space, coworking desks, commercial
          spaces and furniture across India — with no login needed to browse.
        </p>
      </PageSection>

      <PageSection heading="Legal entity">
        <ul className="list-none m-0 p-0 flex flex-col gap-1">
          <li>
            <span className="text-muted">Registered name: </span>
            <span className="text-text font-bold">{LEGAL_ENTITY.legalName}</span>
          </li>
          <li>
            <span className="text-muted">Brand: </span>
            <span className="text-text">{LEGAL_ENTITY.brand} (bhavano.com and the Bhavano mobile app)</span>
          </li>
          {LEGAL_ENTITY.llpin && (
            <li>
              <span className="text-muted">LLPIN: </span>
              <span className="text-text">{LEGAL_ENTITY.llpin}</span>
            </li>
          )}
          {LEGAL_ENTITY.gstin && (
            <li>
              <span className="text-muted">GSTIN: </span>
              <span className="text-text">{LEGAL_ENTITY.gstin}</span>
            </li>
          )}
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
          {LEGAL_ENTITY.supportPhone && (
            <>
              {" "}
              or call{" "}
              <a href={`tel:${LEGAL_ENTITY.supportPhone.replace(/\s/g, "")}`} className="text-green font-bold">
                {LEGAL_ENTITY.supportPhone}
              </a>
            </>
          )}
          . For anything else, see our{" "}
          <Link href="/contact" className="text-green font-bold">
            Contact page
          </Link>{" "}
          or the{" "}
          <Link href="/help" className="text-green font-bold">
            Help centre
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
