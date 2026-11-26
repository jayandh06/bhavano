import Link from "next/link";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";

/** The US Trust & Safety page. India's (app/trust/page.tsx) describes ModerationService's pre-publish checks, photo matching and admin review, none of which the US
 * stack runs yet, so this page claims none of them. Add each statement here only when the US product does it. */
export function UsTrust() {
  return (
    <StaticPageLayout title="Trust & Safety" updated="26 November 2026">
      <PageSection heading="What to know">
        <p className="m-0">
          Listings on Bhavano are posted by owners and agents. We do not inspect properties, we do not verify ownership of a listing, and we
          do not check listings before they appear. Treat every listing as something to confirm for yourself.
        </p>
      </PageSection>

      <PageSection heading="Staying safe">
        <ul className="m-0 pl-5 flex flex-col gap-1.5">
          <li>See a property in person, or through someone you trust, before you pay or sign anything.</li>
          <li>Be wary of anyone who asks you to send a deposit, gift cards or a wire transfer before you have seen the property.</li>
          <li>Check that the person offering a property is the owner or their authorized agent, and read any lease or contract before you sign.</li>
          <li>Keep your conversation on Bhavano until you are comfortable.</li>
        </ul>
      </PageSection>

      <PageSection heading="Fair housing">
        <p className="m-0">
          Listings and messages must not discriminate on race, color, religion, sex, disability, familial status, national origin or any other
          protected characteristic. See our{" "}
          <Link href="/terms" className="text-green font-bold">
            Terms of Service
          </Link>
          .
        </p>
      </PageSection>

      <PageSection heading="Report a listing">
        <p className="m-0">
          If a listing looks fraudulent, discriminatory or wrong, tell us on the{" "}
          <Link href="/contact" className="text-green font-bold">
            Contact us
          </Link>{" "}
          page with a link to the listing and what looks wrong. We may remove listings and suspend accounts that break our Terms.
        </p>
      </PageSection>
    </StaticPageLayout>
  );
}
