import Link from "next/link";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";

export const metadata = {
  title: "Terms of Service — Bhavano",
  description: "The terms and conditions for buying, renting, and posting listings on Bhavano.",
};

export default function TermsPage() {
  return (
    <StaticPageLayout title="Terms of Service" updated="17 July 2026">
      <PageSection heading="1. Acceptance of these terms">
        <p className="m-0">
          By accessing or using Bhavano (the &quot;Platform&quot;) you agree to be bound by these Terms of Service.
          If you do not agree, please do not use the Platform.
        </p>
      </PageSection>

      <PageSection heading="2. What Bhavano is">
        <p className="m-0">
          Bhavano is a classifieds marketplace where users can browse, post, buy, sell, rent or lease real estate
          (houses, apartments, villas, plots, PG accommodation, storage space, coworking desks, commercial spaces) and
          furniture. Listings can be
          browsed without an account; logging in is required to post an ad, favourite a listing, or message another
          user. Bhavano is not a party to any transaction between a buyer and a seller — we provide the platform
          that connects them.
        </p>
      </PageSection>

      <PageSection heading="3. Accounts">
        <p className="m-0">
          You can create an account via phone number (verified with an OTP) or Google sign-in. You are responsible
          for keeping your account credentials secure and for all activity that happens under your account. You must
          provide accurate information, including your name and, if provided, your city, when asked.
        </p>
      </PageSection>

      <PageSection heading="4. Posting listings">
        <p className="m-0">
          When you post a listing you confirm that you have the right to sell, rent, or lease the item or property
          described, and that the price, photos, and details you provide are accurate to the best of your knowledge.
          You may not post listings that are illegal, fraudulent, misleading, or that infringe someone else&apos;s
          rights. We may remove any listing, or suspend an account, that we reasonably believe violates these Terms.
          You can edit or deactivate your own listings at any time from{" "}
          <Link href="/my-listings" className="text-green font-bold">
            My listings
          </Link>
          .
        </p>
      </PageSection>

      <PageSection heading="5. Messaging and conduct">
        <p className="m-0">
          The messaging feature is provided so buyers and sellers can discuss a specific listing. Please use it
          respectfully and do not send spam, harassment, or unrelated solicitations. We may review reported messages
          to enforce these Terms.
        </p>
      </PageSection>

      <PageSection heading="6. No warranty">
        <p className="m-0">
          Listings are created by individual users, not by Bhavano. We do not verify ownership, condition, or
          legal title of any property or item listed, and we make no warranty about the accuracy of any listing.
          You are responsible for doing your own due diligence — including verifying documents and inspecting a
          property or item in person — before entering into any transaction.
        </p>
      </PageSection>

      <PageSection heading="7. Limitation of liability">
        <p className="m-0">
          To the fullest extent permitted by law, Bhavano is not liable for any loss or damage arising from a
          transaction, communication, or dealing between users of the Platform, or from reliance on any listing.
        </p>
      </PageSection>

      <PageSection heading="8. Termination">
        <p className="m-0">
          We may suspend or terminate your access to the Platform if you violate these Terms. You may stop using
          the Platform, or ask us to delete your account, at any time — see{" "}
          <Link href="/contact" className="text-green font-bold">
            Contact us
          </Link>
          .
        </p>
      </PageSection>

      <PageSection heading="9. Changes to these terms">
        <p className="m-0">
          We may update these Terms from time to time. Continued use of the Platform after a change means you
          accept the updated Terms.
        </p>
      </PageSection>

      <PageSection heading="10. Governing law">
        <p className="m-0">These Terms are governed by the laws of India.</p>
      </PageSection>

      <PageSection heading="11. Contact">
        <p className="m-0">
          Questions about these Terms? Reach us at{" "}
          <Link href="/contact" className="text-green font-bold">
            Contact us
          </Link>
          .
        </p>
      </PageSection>
    </StaticPageLayout>
  );
}
