import Link from "next/link";
import { LEGAL_ENTITY, entityAddressLines, entityOperatorSentence } from "@bhavano/types/legalEntity";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";

export const metadata = {
  title: "Privacy Policy — Bhavano",
  description: `How ${LEGAL_ENTITY.legalName}, the operator of Bhavano, collects, uses, and protects your personal information.`,
};

export default function PrivacyPage() {
  const addressLines = entityAddressLines();

  return (
    <StaticPageLayout title="Privacy Policy" updated="1 September 2026">
      <PageSection heading="Who processes your data">
        <p className="m-0">
          {entityOperatorSentence()} {LEGAL_ENTITY.legalName} is the data fiduciary responsible for the personal
          data described in this policy.
        </p>
        {addressLines.length > 0 && (
          <address className="not-italic m-0 mt-2">
            <span className="text-muted">Registered office: </span>
            {addressLines.join(", ")}
          </address>
        )}
        <p className="m-0 mt-2">
          Privacy and grievance queries:{" "}
          <a href={`mailto:${LEGAL_ENTITY.supportEmail}`} className="text-green font-bold">
            {LEGAL_ENTITY.supportEmail}
          </a>
          .
        </p>
      </PageSection>

      <PageSection heading="1. Information we collect">
        <p className="m-0 mb-2">We collect the following information:</p>
        <ul className="list-disc m-0 pl-5">
          <li>
            <strong>Account information:</strong> your phone number (verified via OTP) or, if you sign in with
            Google, your Google account name and email address.
          </li>
          <li>
            <strong>Profile information:</strong> your name and city/state, if you choose to add them on your{" "}
            <Link href="/profile" className="text-green font-bold">
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
          <li>
            <strong>Technical data:</strong> your IP address and the page you first arrived on, recorded once per
            browsing session, to investigate abuse and understand how visitors reach the Platform. We also derive an
            approximate city, region, and country from that IP address using a local lookup database — this is a
            coarse estimate (it can be wrong, particularly on mobile networks) used only for our own internal
            reporting, and never to choose what you see on the Platform.
          </li>
          <li>
            <strong>Location data:</strong> precise location is only ever collected if you tap &quot;Auto-detect my
            current location&quot; in the location selector at the top of any page. Your device asks your
            permission first; if you agree, your coordinates are sent to our servers and from there to
            Google&apos;s geocoding service, solely to work out which city and area you are in. Other than the
            coarse, IP-based estimate described above, we do not otherwise track or store your location, and you
            can always pick a city yourself from the same selector instead.
          </li>
        </ul>
      </PageSection>

      <PageSection heading="2. How we use this information">
        <p className="m-0">We use the information above to:</p>
        <ul className="list-disc mt-2 mb-0 mx-0 pl-5">
          <li>authenticate you and keep your account secure;</li>
          <li>show you listings relevant to your city and pre-fill it as a convenience on your profile;</li>
          <li>display your listings to other users and let them contact you about them;</li>
          <li>show view/favourite counts on listings, and maintain your favourites and message history;</li>
          <li>moderate content and enforce our Terms of Service.</li>
        </ul>
      </PageSection>

      <PageSection heading="3. What we share">
        <p className="m-0">
          We do not sell your personal information. Your name and the contact details you choose to share are
          visible to another user only once you message them (or they message you) about a specific listing. We may
          share information with service providers that host our infrastructure (database, file storage) solely to
          operate the Platform, and where required by law.
        </p>
      </PageSection>

      <PageSection heading="4. Cookies and sessions">
        <p className="m-0">
          We use a session cookie to keep you signed in, and a cookie that remembers which city you last browsed
          so the Platform opens on it next time. We do not use third-party advertising or tracking cookies.
        </p>
      </PageSection>

      <PageSection heading="5. Data retention">
        <p className="m-0">
          We retain your account and listing data for as long as your account is active. Listings automatically
          expire after a fixed posting period; you can also deactivate a listing yourself at any time from{" "}
          <Link href="/my-listings" className="text-green font-bold">
            My listings
          </Link>
          .
        </p>
      </PageSection>

      <PageSection heading="6. Your rights">
        <p className="m-0">
          You can review and update your name and city at any time from your{" "}
          <Link href="/profile" className="text-green font-bold">
            profile page
          </Link>
          . To request a copy of your data, or to have your account and data deleted, contact us — see below.
        </p>
      </PageSection>

      <PageSection heading="7. Security">
        <p className="m-0">
          We take reasonable technical measures to protect your information, but no method of transmission or
          storage is completely secure, and we cannot guarantee absolute security.
        </p>
      </PageSection>

      <PageSection heading="8. Children's privacy">
        <p className="m-0">Bhavano is not directed at children under 18, and we do not knowingly collect their data.</p>
      </PageSection>

      <PageSection heading="9. Changes to this policy">
        <p className="m-0">
          We may update this Privacy Policy from time to time. We&apos;ll update the &quot;Last updated&quot; date
          above when we do.
        </p>
      </PageSection>

      <PageSection heading="10. Contact">
        <p className="m-0">
          Questions about this policy, or a request to access/delete your data? Reach us at{" "}
          <Link href="/contact" className="text-green font-bold">
            Contact us
          </Link>
          .
        </p>
      </PageSection>
    </StaticPageLayout>
  );
}
