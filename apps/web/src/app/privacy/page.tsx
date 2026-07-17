import Link from "next/link";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";

export const metadata = { title: "Privacy Policy — Bhavano" };

export default function PrivacyPage() {
  return (
    <StaticPageLayout title="Privacy Policy" updated="17 July 2026">
      <PageSection heading="1. Information we collect">
        <p style={{ margin: "0 0 8px" }}>We collect the following information:</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            <strong>Account information:</strong> your phone number (verified via OTP) or, if you sign in with
            Google, your Google account name and email address.
          </li>
          <li>
            <strong>Profile information:</strong> your name and city/state, if you choose to add them on your{" "}
            <Link href="/profile" style={{ color: "var(--green)", fontWeight: 700 }}>
              profile
            </Link>
            . Your city can be auto-detected from your browser&apos;s location, which you can review and change
            before saving — it is never saved automatically.
          </li>
          <li>
            <strong>Listing content:</strong> anything you include in an ad you post — title, price, description,
            photos, and category-specific details.
          </li>
          <li>
            <strong>Usage data:</strong> which listings you view or favourite, and messages you send through the
            Platform&apos;s messaging feature.
          </li>
        </ul>
      </PageSection>

      <PageSection heading="2. How we use this information">
        <p style={{ margin: 0 }}>We use the information above to:</p>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
          <li>authenticate you and keep your account secure;</li>
          <li>show you listings relevant to your city and pre-fill it as a convenience on your profile;</li>
          <li>display your listings to other users and let them contact you about them;</li>
          <li>show view/favourite counts on listings, and maintain your favourites and message history;</li>
          <li>moderate content and enforce our Terms of Service.</li>
        </ul>
      </PageSection>

      <PageSection heading="3. What we share">
        <p style={{ margin: 0 }}>
          We do not sell your personal information. Your name and the contact details you choose to share are
          visible to another user only once you message them (or they message you) about a specific listing. We may
          share information with service providers that host our infrastructure (database, file storage) solely to
          operate the Platform, and where required by law.
        </p>
      </PageSection>

      <PageSection heading="4. Cookies and sessions">
        <p style={{ margin: 0 }}>
          We use a session cookie to keep you signed in. We do not use third-party advertising or tracking cookies.
        </p>
      </PageSection>

      <PageSection heading="5. Data retention">
        <p style={{ margin: 0 }}>
          We retain your account and listing data for as long as your account is active. Listings automatically
          expire after a fixed posting period; you can also deactivate a listing yourself at any time from{" "}
          <Link href="/my-listings" style={{ color: "var(--green)", fontWeight: 700 }}>
            My listings
          </Link>
          .
        </p>
      </PageSection>

      <PageSection heading="6. Your rights">
        <p style={{ margin: 0 }}>
          You can review and update your name and city at any time from your{" "}
          <Link href="/profile" style={{ color: "var(--green)", fontWeight: 700 }}>
            profile page
          </Link>
          . To request a copy of your data, or to have your account and data deleted, contact us — see below.
        </p>
      </PageSection>

      <PageSection heading="7. Security">
        <p style={{ margin: 0 }}>
          We take reasonable technical measures to protect your information, but no method of transmission or
          storage is completely secure, and we cannot guarantee absolute security.
        </p>
      </PageSection>

      <PageSection heading="8. Children's privacy">
        <p style={{ margin: 0 }}>Bhavano is not directed at children under 18, and we do not knowingly collect their data.</p>
      </PageSection>

      <PageSection heading="9. Changes to this policy">
        <p style={{ margin: 0 }}>
          We may update this Privacy Policy from time to time. We&apos;ll update the &quot;Last updated&quot; date
          above when we do.
        </p>
      </PageSection>

      <PageSection heading="10. Contact">
        <p style={{ margin: 0 }}>
          Questions about this policy, or a request to access/delete your data? Reach us at{" "}
          <Link href="/contact" style={{ color: "var(--green)", fontWeight: 700 }}>
            Contact us
          </Link>
          .
        </p>
      </PageSection>
    </StaticPageLayout>
  );
}
