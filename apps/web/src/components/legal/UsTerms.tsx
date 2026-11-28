import Link from "next/link";
import { LEGAL_ENTITY, entityOperatorSentence } from "@bhavano/types/legalEntity";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";
import { DraftNotice } from "./DraftNotice";

/** The US Terms of Service (draft for counsel review, docs/plans/us-legal-pages.md). India's terms are app/terms/page.tsx and name Indian law, OTP sign-in and Razorpay. */
export function UsTerms() {
  return (
    <StaticPageLayout title="Terms of Service" updated="26 November 2026">
      <DraftNotice />

      <PageSection heading="1. Acceptance of these terms">
        <p className="m-0">
          By accessing or using Bhavano (the &quot;Platform&quot;) you agree to be bound by these Terms of Service. If you do not agree,
          please do not use the Platform.
        </p>
        <p className="m-0 mt-2">
          {entityOperatorSentence()} References to &quot;we&quot;, &quot;us&quot; and &quot;our&quot; in these terms mean{" "}
          {LEGAL_ENTITY.legalName}.
        </p>
      </PageSection>

      <PageSection heading="2. What Bhavano is">
        <p className="m-0">
          Bhavano is a classifieds marketplace where people can browse, post, rent, buy and sell homes, condos, townhouses, manufactured homes, multi-family buildings, land, rooms, storage
          space and commercial space. Listings can be browsed without an account; you need to sign in to post a listing, save a favorite or
          message another user. Bhavano is not a party to any transaction between users. We provide the platform that connects them.
        </p>
        <p className="m-0 mt-2">
          Bhavano is not a real estate broker, agent, lender or landlord, and nothing on the Platform is legal, financial or real estate
          advice.
        </p>
      </PageSection>

      <PageSection heading="3. Accounts">
        <p className="m-0">
          You can create an account by signing in with Google. You are responsible for keeping your account secure and for all activity under
          it. You must be at least 18 years old and give accurate information, including your name and, when asked, your city and contact
          details.
        </p>
      </PageSection>

      <PageSection heading="4. Posting listings">
        <p className="m-0">
          When you post a listing you confirm that you have the right to rent, sell or lease the property or item described, and that the
          price, photos and details are accurate to the best of your knowledge. You may not post listings that are illegal, fraudulent,
          misleading, or that infringe someone else&apos;s rights. We may remove any listing, or suspend an account, that we reasonably
          believe breaks these Terms. You can edit or deactivate your own listings at any time from{" "}
          <Link href="/my-listings" className="text-green font-bold">
            My listings
          </Link>
          .
        </p>
      </PageSection>

      <PageSection heading="5. Fair housing">
        <p className="m-0">
          Housing on Bhavano must be offered fairly. You may not post a listing, or send a message, that states or suggests a preference,
          limitation or discrimination based on race, color, religion, sex (including sexual orientation and gender identity), disability,
          familial status or national origin, or on any other characteristic protected by federal, state or local law, and you may not
          refuse to deal with someone for those reasons. We may remove listings and suspend accounts that do. If you see a listing that
          looks discriminatory, tell us through our{" "}
          <Link href="/contact" className="text-green font-bold">
            contact page
          </Link>
          .
        </p>
        <p className="m-0 mt-2">Equal Housing Opportunity.</p>
      </PageSection>

      <PageSection heading="6. Messaging and conduct">
        <p className="m-0">
          Messaging is provided so people can discuss a specific listing. Please use it respectfully and do not send spam, harassment or
          unrelated solicitations. We may review reported messages to enforce these Terms.
        </p>
      </PageSection>

      <PageSection heading="7. No warranty">
        <p className="m-0">
          Listings are created by individual users, not by Bhavano. We do not verify ownership, condition or legal title of any property
          listed, we do not inspect properties, and we make no warranty about the accuracy of any listing. You are responsible for your own
          due diligence, including checking documents, reviewing any lease or purchase agreement, and seeing a property in person before you
          pay or sign anything. Be careful with requests to send money before you have seen a property.
        </p>
        <p className="m-0 mt-2">
          The Platform is provided &quot;as is&quot; and &quot;as available&quot;, to the fullest extent the law allows. [Counsel to confirm
          the disclaimer wording.]
        </p>
      </PageSection>

      <PageSection heading="8. Limitation of liability">
        <p className="m-0">
          To the fullest extent permitted by law, Bhavano is not liable for any loss or damage arising from a transaction, communication or
          dealing between users, or from reliance on any listing. [Counsel to confirm the limits, including any cap on liability.]
        </p>
      </PageSection>

      <PageSection heading="9. Termination">
        <p className="m-0">
          We may suspend or end your access if you break these Terms. You may stop using the Platform, or ask us to delete your account, at
          any time; see{" "}
          <Link href="/contact" className="text-green font-bold">
            Contact us
          </Link>
          .
        </p>
      </PageSection>

      <PageSection heading="10. Paid features">
        <p className="m-0">
          The Platform on this site is free to use for now. If we introduce paid features, their price and length will be shown before you
          pay, and these Terms will be updated with the payment and renewal terms.
        </p>
      </PageSection>

      <PageSection heading="11. Changes to these terms">
        <p className="m-0">
          We may update these Terms from time to time and will change the &quot;Last updated&quot; date above when we do. Continued use of
          the Platform after a change means you accept the updated Terms.
        </p>
      </PageSection>

      <PageSection heading="12. Governing law and disputes">
        <p className="m-0">[Governing law, venue and any arbitration or class-action terms to be set by counsel.]</p>
      </PageSection>

      <PageSection heading="13. Contact">
        <p className="m-0">
          Questions about these Terms? Email{" "}
          <a href={`mailto:${LEGAL_ENTITY.supportEmail}`} className="text-green font-bold">
            {LEGAL_ENTITY.supportEmail}
          </a>{" "}
          or use our{" "}
          <Link href="/contact" className="text-green font-bold">
            contact page
          </Link>
          .
        </p>
      </PageSection>
    </StaticPageLayout>
  );
}
