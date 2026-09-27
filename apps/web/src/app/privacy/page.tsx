import Link from "next/link";
import { LEGAL_ENTITY, entityAddressLines, entityOperatorSentence } from "@bhavano/types/legalEntity";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";

export const metadata = {
  title: "Privacy Policy — Bhavano",
  description: `How ${LEGAL_ENTITY.legalName}, the operator of Bhavano, collects, uses, shares, and protects your personal information on the Bhavano website and mobile apps.`,
};

// Mirrored in apps/mobile/app/privacy.tsx — keep both in sync. This page is also the privacy
// policy URL on the Google Play and App Store listings, and #delete-account / #delete-data are the
// Play Console account- and data-deletion URLs, so it must stay public (no login) and describe
// what the apps actually do.
export default function PrivacyPage() {
  const addressLines = entityAddressLines();

  return (
    <StaticPageLayout title="Privacy Policy" updated="27 September 2026">
      <PageSection heading="Who processes your data">
        <p className="m-0">
          {entityOperatorSentence()} {LEGAL_ENTITY.legalName} is the data fiduciary responsible for the personal
          data described in this policy. It applies to the Bhavano website (bhavano.com) and the Bhavano apps for
          Android and iOS (together, the &quot;Platform&quot;).
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
        <ul className="list-disc m-0 pl-5 flex flex-col gap-1.5">
          <li>
            <strong>Account information:</strong> your phone number (verified by a one-time code), and/or the name
            and email address from your Google or Apple account if you sign in with one. If you use Sign in with
            Apple and choose to hide your email, we receive Apple&apos;s private relay address instead.
          </li>
          <li>
            <strong>Profile information:</strong> your name, city, and a verified email address or phone number,
            which we ask for after you first log in. You can review and change these on your{" "}
            <Link href="/profile" className="text-green font-bold">
              profile
            </Link>
            .
          </li>
          <li>
            <strong>Listing content:</strong> anything you include in an ad you post, such as title, price,
            description, location, category-specific details, and the photos and videos you upload. In the app, we
            only access the photos or videos you pick from your device&apos;s library. We do not browse the rest of
            your library.
          </li>
          <li>
            <strong>Activity on the Platform:</strong> the listings you view or favourite, messages you send and
            receive through Bhavano&apos;s messaging feature, contact details you unlock, saved searches, and property
            requirements you post (including whether you agreed to let us share your number with matching
            owners).
          </li>
          <li>
            <strong>Purchases:</strong> what you bought (for example a Boost, Instant Alerts, contact-unlock credits
            or a subscription), the amount, and whether the payment succeeded. Card, UPI and bank details are entered
            directly with our payment processor, Razorpay. We never receive or store them.
          </li>
          <li>
            <strong>Device and notification data:</strong> if you allow notifications in the app, a push notification
            token for your device, so we can alert you about new messages and activity on your listings. We also
            record whether you are using a desktop, mobile browser, tablet or the app.
          </li>
          <li>
            <strong>Technical data:</strong> your IP address, the page you first arrived on, and the pages or screens
            you visit during that session, to investigate abuse and understand how people use the Platform. We derive
            an approximate city, region and country from your IP address using a local lookup database. This is a
            coarse estimate used only for our own internal reporting, never to choose what you see.
          </li>
          <li>
            <strong>Advertising attribution:</strong> if you reach Bhavano by clicking one of our Google ads, we store
            the ad click identifier and the campaign source with your account, so we can tell which ads lead to
            sign-ups, listings and purchases.
          </li>
          <li>
            <strong>Location data:</strong> precise location is only collected if you tap &quot;Auto-detect my
            current location&quot;, or drop a pin on the map while posting an ad. Your device asks your permission
            first. If you agree, your coordinates are sent to our servers and from there to Google&apos;s mapping
            services, solely to work out the city and area (and, for an ad, to show its location). We do not track
            your location in the background.
          </li>
        </ul>
      </PageSection>

      <PageSection heading="2. How we use this information">
        <p className="m-0">We use the information above to:</p>
        <ul className="list-disc mt-2 mb-0 mx-0 pl-5">
          <li>create your account, authenticate you and keep your account secure;</li>
          <li>show you listings relevant to your city;</li>
          <li>display your listings to other users and let them contact you about them;</li>
          <li>deliver messages between users, and maintain your favourites, saved searches and history;</li>
          <li>
            send you notifications (in-app, push, SMS, WhatsApp or email) about your account, your listings, messages,
            matching properties, and purchases;
          </li>
          <li>process payments and keep records of them, including for tax and accounting;</li>
          <li>
            occasionally tell you about paid features for your own listings, such as Boost. To stop these, contact
            us;
          </li>
          <li>understand how the Platform is used and measure how well our advertising works;</li>
          <li>moderate content, prevent fraud and abuse, and enforce our Terms of Service.</li>
        </ul>
      </PageSection>

      <PageSection heading="3. Who we share it with">
        <p className="m-0">We do not sell your personal information. We share it only as follows:</p>
        <ul className="list-disc mt-2 mb-0 mx-0 pl-5 flex flex-col gap-1.5">
          <li>
            <strong>Other users:</strong> your listings are public. Your name and the contact details you choose to
            share become visible to another user once you message each other about a listing, or once they unlock
            your listing&apos;s contact details.
          </li>
          <li>
            <strong>Service providers</strong> that run parts of the Platform for us, only for that purpose:
            <ul className="list-[circle] mt-1 mb-0 pl-5">
              <li>cloud hosting and database (Amazon Web Services, India);</li>
              <li>photo and video storage and delivery (Cloudflare);</li>
              <li>payments (Razorpay);</li>
              <li>sign-in (Google, Apple);</li>
              <li>one-time codes, SMS and WhatsApp messages (MSG91, Meta&apos;s WhatsApp Business Platform);</li>
              <li>email (Zoho Mail);</li>
              <li>
                push notifications (Expo, which delivers through Google Firebase Cloud Messaging and Apple Push
                Notification service);
              </li>
              <li>maps and location lookup (Google Maps Platform).</li>
            </ul>
          </li>
          <li>
            <strong>Advertising and analytics (Google):</strong> when you sign up, post an ad or make a purchase after
            clicking one of our Google ads, we send Google Ads the ad click identifier together with your email
            address and/or phone number in hashed (one-way encrypted) form, so Google can attribute that result to
            the ad. On iOS we only do this if you allow tracking when the app asks. See also section 4.
          </li>
          <li>
            <strong>Legal and safety:</strong> where required by law, court order or a government authority, or to
            protect the rights and safety of our users and the Platform.
          </li>
        </ul>
        <p className="m-0 mt-2">
          Some of these providers may process data outside India. When they do, it is under their own security and
          privacy commitments.
        </p>
      </PageSection>

      <PageSection heading="4. Cookies, analytics and advertising">
        <p className="m-0">
          On the website, we use a session cookie to keep you signed in and a cookie that remembers the city you last
          browsed. The website also loads Google Tag Manager, which runs Google&apos;s analytics and advertising
          measurement tags (Google Analytics and Google Ads). These may set cookies that measure visits and link a
          sign-up or purchase back to the ad that led to it. You can block or delete cookies in your browser
          settings. The Platform keeps working without them, although you will need to sign in again.
        </p>
        <p className="m-0 mt-2">
          In the apps, your session is stored securely on your device instead of in a cookie. The apps do not use
          your device&apos;s advertising ID.
        </p>
      </PageSection>

      <PageSection heading="5. Listings from public business information">
        <p className="m-0">
          Some PG and coworking listings are created from publicly available business information, such as business
          listings on Google Maps. We may contact that business on its public phone number (for example on
          WhatsApp) so the owner can claim, correct or remove the listing. To have such a listing removed, contact
          us.
        </p>
      </PageSection>

      <PageSection heading="6. Data retention">
        <p className="m-0">
          We keep your account and listing data for as long as your account is active. Listings expire automatically
          after their posting period, and you can deactivate a listing yourself at any time from{" "}
          <Link href="/my-listings" className="text-green font-bold">
            My listings
          </Link>
          . When you delete your account, we remove your personal details as described in section 7. Payment records
          are kept for as long as tax and accounting law requires.
        </p>
      </PageSection>

      <PageSection heading="7. Deleting your data or your account" id="delete-account">
        <div id="delete-data" className="scroll-mt-24">
          <p className="m-0 font-bold text-text">Deleting some of your data (keeping your account)</p>
          <ul className="list-disc mt-2 mb-0 mx-0 pl-5">
            <li>
              <strong>Listing photos and videos:</strong> open{" "}
              <Link href="/my-listings" className="text-green font-bold">
                My listings
              </Link>
              , choose Edit on the ad, and remove the photo or video. The file is deleted from our storage.
            </li>
            <li>
              <strong>Favourites:</strong> tap the heart on a saved listing again to remove it.
            </li>
            <li>
              <strong>Messages:</strong> press and hold (app) or use the delete option (website) on a message you
              sent. The other person then sees &quot;This message was deleted&quot;. We keep the original text for
              moderation and safety reviews.
            </li>
            <li>
              <strong>Listings:</strong> deactivate an ad from My listings to take it offline. Its details are kept
              so you can reactivate it, but it is removed from public view.
            </li>
            <li>
              <strong>Anything else</strong> (for example your page-visit history or a specific message): email{" "}
              <a href={`mailto:${LEGAL_ENTITY.supportEmail}`} className="text-green font-bold">
                {LEGAL_ENTITY.supportEmail}
              </a>{" "}
              from the email address, or mentioning the phone number, on your account, and say what you want
              deleted.
            </li>
          </ul>
        </div>

        <p className="m-0 mt-4 font-bold text-text">Deleting your whole account</p>
        <p className="m-0 mt-2">You can delete your Bhavano account at any time:</p>
        <ul className="list-disc mt-2 mb-0 mx-0 pl-5">
          <li>
            <strong>In the app:</strong> open Account, then tap &quot;Delete my account&quot;.
          </li>
          <li>
            <strong>On the website:</strong> sign in, open your{" "}
            <Link href="/profile" className="text-green font-bold">
              profile
            </Link>
            , and choose &quot;Delete my account&quot;.
          </li>
          <li>
            <strong>By email:</strong> if you can no longer sign in, write to{" "}
            <a href={`mailto:${LEGAL_ENTITY.supportEmail}`} className="text-green font-bold">
              {LEGAL_ENTITY.supportEmail}
            </a>{" "}
            from the email address, or mentioning the phone number, on your account.
          </li>
        </ul>
        <p className="m-0 mt-2">
          Deleting your account immediately removes your name, phone number, email address, linked Google or Apple
          sign-in, city, advertising attribution and saved searches, and takes all your listings offline. We keep a
          record of past payments with your personal details removed, for tax and accounting purposes. Messages you
          already sent stay in the other person&apos;s conversation, no longer linked to your identity.
        </p>
      </PageSection>

      <PageSection heading="8. Your rights">
        <p className="m-0">
          You can review and update your name, city and contact details at any time from your{" "}
          <Link href="/profile" className="text-green font-bold">
            profile page
          </Link>
          , and turn off push notifications in your device settings. To ask for a copy of your data, correct it, or
          raise a grievance, contact us using the details below. We will respond within the time required by
          applicable law, including India&apos;s Digital Personal Data Protection Act, 2023.
        </p>
      </PageSection>

      <PageSection heading="9. Security">
        <p className="m-0">
          All data sent between your device and our servers is encrypted in transit (HTTPS). We take reasonable
          technical and organisational measures to protect your information, but no method of transmission or
          storage is completely secure, and we cannot guarantee absolute security.
        </p>
      </PageSection>

      <PageSection heading="10. Children's privacy">
        <p className="m-0">Bhavano is not directed at children under 18, and we do not knowingly collect their data.</p>
      </PageSection>

      <PageSection heading="11. Changes to this policy">
        <p className="m-0">
          We may update this Privacy Policy from time to time. We&apos;ll update the &quot;Last updated&quot; date
          above when we do.
        </p>
      </PageSection>

      <PageSection heading="12. Contact">
        <p className="m-0">
          Questions about this policy, or a request about your data? Email{" "}
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
