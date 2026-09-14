import { LEGAL_ENTITY, entityOperatorSentence } from "@bhavano/types/legalEntity";
import { P, PageLink, PageSection, StaticPageLayout } from "../src/components/home/StaticPageLayout";

// Mirrors apps/web/src/app/terms/page.tsx — see StaticPageLayout's own note on why this is
// duplicated rather than loaded from the live page.
export default function TermsScreen() {
  return (
    <StaticPageLayout title="Terms of Service" updated="26 August 2026">
      <PageSection heading="1. Acceptance of these terms">
        <P>
          By accessing or using Bhavano (the &ldquo;Platform&rdquo;) you agree to be bound by these Terms of
          Service. If you do not agree, please do not use the Platform.
        </P>
        <P>
          {entityOperatorSentence()} References to &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; in
          these terms mean {LEGAL_ENTITY.legalName}.
        </P>
      </PageSection>

      <PageSection heading="2. What Bhavano is">
        <P>
          Bhavano is a classifieds marketplace where users can browse, post, buy, sell, rent or lease real estate
          (houses, apartments, villas, plots, PG accommodation, storage space, coworking desks, commercial spaces)
          and furniture. Listings can be browsed without an account; logging in is required to post an ad,
          favourite a listing, or message another user. Bhavano is not a party to any transaction between a buyer
          and a seller — we provide the platform that connects them.
        </P>
      </PageSection>

      <PageSection heading="3. Accounts">
        <P>
          You can create an account via phone number (verified with an OTP) or Google sign-in. You are responsible
          for keeping your account credentials secure and for all activity that happens under your account. You
          must provide accurate information, including your name and, if provided, your city, when asked.
        </P>
      </PageSection>

      <PageSection heading="4. Posting listings">
        <P>
          When you post a listing you confirm that you have the right to sell, rent, or lease the item or property
          described, and that the price, photos, and details you provide are accurate to the best of your
          knowledge. You may not post listings that are illegal, fraudulent, misleading, or that infringe someone
          else&rsquo;s rights. We may remove any listing, or suspend an account, that we reasonably believe
          violates these Terms. You can edit or deactivate your own listings at any time from{" "}
          <PageLink href="/my-listings">My listings</PageLink>.
        </P>
      </PageSection>

      <PageSection heading="5. Messaging and conduct">
        <P>
          The messaging feature is provided so buyers and sellers can discuss a specific listing. Please use it
          respectfully and do not send spam, harassment, or unrelated solicitations. We may review reported
          messages to enforce these Terms.
        </P>
      </PageSection>

      <PageSection heading="6. No warranty">
        <P>
          Listings are created by individual users, not by Bhavano. We do not verify ownership, condition, or
          legal title of any property or item listed, and we make no warranty about the accuracy of any listing.
          You are responsible for doing your own due diligence — including verifying documents and inspecting a
          property or item in person — before entering into any transaction.
        </P>
      </PageSection>

      <PageSection heading="7. Limitation of liability">
        <P>
          To the fullest extent permitted by law, Bhavano is not liable for any loss or damage arising from a
          transaction, communication, or dealing between users of the Platform, or from reliance on any listing.
        </P>
      </PageSection>

      <PageSection heading="8. Termination">
        <P>
          We may suspend or terminate your access to the Platform if you violate these Terms. You may stop using
          the Platform, or ask us to delete your account, at any time — see <PageLink href="/contact">Contact us</PageLink>.
        </P>
      </PageSection>

      <PageSection heading="9. Changes to these terms">
        <P>
          We may update these Terms from time to time. Continued use of the Platform after a change means you
          accept the updated Terms.
        </P>
      </PageSection>

      <PageSection heading="10. Governing law">
        <P>These Terms are governed by the laws of India.</P>
      </PageSection>

      <PageSection heading="11. Contact">
        <P>
          Questions about these Terms? Reach us at <PageLink href="/contact">Contact us</PageLink>.
        </P>
      </PageSection>
    </StaticPageLayout>
  );
}
