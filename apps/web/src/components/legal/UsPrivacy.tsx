import Link from "next/link";
import { LEGAL_ENTITY, entityOperatorSentence } from "@bhavano/types/legalEntity";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";
import { DraftNotice } from "./DraftNotice";

/** The US Privacy Policy (draft for counsel review, docs/plans/us-legal-pages.md). India's policy is app/privacy/page.tsx (DPDP Act, Razorpay, MSG91, Meta ads).
 * Every statement here describes what the US stack does today; analytics is mentioned only when the build has a Tag Manager id, like India's Meta paragraph. */
export function UsPrivacy() {
  const analytics = !!process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <StaticPageLayout title="Privacy Policy" updated="26 November 2026">
      <DraftNotice />

      <PageSection heading="Who we are">
        <p className="m-0">
          {entityOperatorSentence()} {LEGAL_ENTITY.legalName} decides how the personal information described in this policy is used. It
          applies to the Bhavano website (bhavano.com/us) and the Bhavano apps (together, the &quot;Platform&quot;).
        </p>
        <p className="m-0 mt-2">
          Privacy questions and requests:{" "}
          <a href={`mailto:${LEGAL_ENTITY.supportEmail}`} className="text-green font-bold">
            {LEGAL_ENTITY.supportEmail}
          </a>
          .
        </p>
      </PageSection>

      <PageSection heading="1. Information we collect">
        <ul className="list-disc m-0 pl-5 flex flex-col gap-1.5">
          <li>
            <strong>Account information:</strong> the name and email address from your Google account when you sign in with Google, and the
            phone number you give us if we ask you to verify one before you post.
          </li>
          <li>
            <strong>Profile information:</strong> your name, city and contact details, which you can review and change on your{" "}
            <Link href="/profile" className="text-green font-bold">
              profile
            </Link>
            .
          </li>
          <li>
            <strong>Listing content:</strong> everything you put in a listing, such as the title, price, description, location, details and
            the photos you upload. Listings are public.
          </li>
          <li>
            <strong>Activity:</strong> listings you save, messages you send and receive through the Platform, saved searches and property
            requirements you post.
          </li>
          <li>
            <strong>Device and technical data:</strong> your IP address, browser and device type, the pages you visit, and an approximate city
            and region worked out from your IP address. We use this to run and secure the Platform and to understand how it is used.
          </li>
          <li>
            <strong>Precise location:</strong> collected only if you choose to use your current location, or drop a pin on the map while
            posting. Your device asks permission first. We send the coordinates to Google&apos;s mapping services to work out the city and
            area, and we do not track your location in the background.
          </li>
        </ul>
      </PageSection>

      <PageSection heading="2. How we use it">
        <ul className="list-disc m-0 pl-5">
          <li>to create your account, sign you in and keep it secure;</li>
          <li>to show your listings to other people and let them contact you about them;</li>
          <li>to deliver messages between users and keep your saved listings and searches;</li>
          <li>to send you notices about your account, your listings and your messages;</li>
          <li>to understand how the Platform is used and to improve it;</li>
          <li>to prevent fraud and abuse, to enforce our Terms and to meet legal obligations.</li>
        </ul>
      </PageSection>

      <PageSection heading="3. Who we share it with">
        <p className="m-0">We do not sell your personal information, and we do not share it for cross-context behavioral advertising.</p>
        <ul className="list-disc mt-2 mb-0 mx-0 pl-5 flex flex-col gap-1.5">
          <li>
            <strong>Other users:</strong> your listings are public. Your name and the contact details you choose to share become visible to
            another user when you message each other about a listing.
          </li>
          <li>
            <strong>Service providers</strong> that run parts of the Platform for us, only for that purpose: cloud hosting and database
            (Amazon Web Services, United States), photo storage and delivery (Cloudflare), sign-in (Google), maps and location lookup (Google
            Maps Platform) and email (Zoho Mail).
          </li>
          <li>
            <strong>Legal and safety:</strong> where required by law, court order or a government authority, or to protect the rights and
            safety of our users and the Platform.
          </li>
          <li>
            <strong>Business changes:</strong> if Bhavano is merged with or acquired by another company, your information may go with it,
            under this policy.
          </li>
        </ul>
        <p className="m-0 mt-2">
          Our servers are in the United States. {LEGAL_ENTITY.legalName} is based in India, so our team there may access your information to
          run and support the Platform. [Counsel to confirm the cross-border wording.]
        </p>
      </PageSection>

      <PageSection heading="4. Cookies and analytics">
        <p className="m-0">
          We use a session cookie to keep you signed in and a cookie that remembers the city you last browsed.
          {analytics
            ? " The website also loads Google Tag Manager, which runs analytics tags that may set cookies to measure visits. You can block or delete cookies in your browser settings; the Platform keeps working without them, although you will need to sign in again."
            : " We do not use advertising cookies. You can block or delete cookies in your browser settings; the Platform keeps working without them, although you will need to sign in again."}
        </p>
      </PageSection>

      <PageSection heading="5. How long we keep it">
        <p className="m-0">
          We keep your account and listing data while your account is active. Listings expire after their posting period, and you can
          deactivate one at any time from{" "}
          <Link href="/my-listings" className="text-green font-bold">
            My listings
          </Link>
          . When you delete your account we remove your personal details, and we may keep limited records where the law requires it or to
          resolve disputes and prevent abuse. [Counsel to confirm retention periods.]
        </p>
      </PageSection>

      <PageSection heading="6. Your privacy rights" id="delete-account">
        <p className="m-0">
          Depending on where you live (for example California), you may have the right to know what personal information we collect, use and
          disclose, to request a copy of it, to correct it, to delete it, and to opt out of the sale or sharing of your information. We do
          not sell or share it, so there is nothing to opt out of. We will not treat you differently for using these rights.
        </p>
        <p className="m-0 mt-2">
          To make a request, email{" "}
          <a href={`mailto:${LEGAL_ENTITY.supportEmail}`} className="text-green font-bold">
            {LEGAL_ENTITY.supportEmail}
          </a>{" "}
          from the email address on your account. We may need to confirm it is you, and we will respond within 45 days. An authorized agent
          can make a request for you with your written permission. You can also delete your account yourself: sign in, open your{" "}
          <Link href="/profile" className="text-green font-bold">
            profile
          </Link>{" "}
          and choose &quot;Delete my account&quot;. That removes your name, email address, phone number, city and saved searches and takes
          your listings offline.
        </p>
      </PageSection>

      <PageSection heading="7. Security">
        <p className="m-0">
          Data sent between your device and our servers is encrypted in transit (HTTPS). We take reasonable measures to protect your
          information, but no method of transmission or storage is completely secure.
        </p>
      </PageSection>

      <PageSection heading="8. Children">
        <p className="m-0">Bhavano is not directed at anyone under 18, and we do not knowingly collect their information.</p>
      </PageSection>

      <PageSection heading="9. Changes to this policy">
        <p className="m-0">
          We may update this policy from time to time and will change the &quot;Last updated&quot; date above when we do.
        </p>
      </PageSection>

      <PageSection heading="10. Contact">
        <p className="m-0">
          Questions about this policy? Email{" "}
          <a href={`mailto:${LEGAL_ENTITY.supportEmail}`} className="text-green font-bold">
            {LEGAL_ENTITY.supportEmail}
          </a>{" "}
          or use our{" "}
          <Link href="/contact" className="text-green font-bold">
            contact page
          </Link>
          . [Postal address to be added once the entity&apos;s mailing address is confirmed.]
        </p>
      </PageSection>
    </StaticPageLayout>
  );
}
