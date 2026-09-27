import { Linking, Text, View } from "react-native";
import { LEGAL_ENTITY, entityAddressLines, entityOperatorSentence } from "@bhavano/types/legalEntity";
import { useAppTheme } from "../src/theme/ThemeContext";
import { P, PageLink, PageSection, StaticPageLayout } from "../src/components/home/StaticPageLayout";

function Bullet({ children, indent = false }: { children: React.ReactNode; indent?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6, paddingLeft: indent ? 14 : 0 }}>
      <Text style={{ fontSize: 13.5, color: colors.textSoft }}>{indent ? "◦" : "•"}</Text>
      <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 21, color: colors.textSoft }}>{children}</Text>
    </View>
  );
}

// Mirrors apps/web/src/app/privacy/page.tsx — see StaticPageLayout's own note on why this is
// duplicated rather than loaded from the live page. Keep both in sync.
export default function PrivacyScreen() {
  const { colors } = useAppTheme();
  const addressLines = entityAddressLines();
  const b = (label: string) => <Text style={{ fontWeight: "700", color: colors.text }}>{label}</Text>;
  const mail = (
    <Text onPress={() => Linking.openURL(`mailto:${LEGAL_ENTITY.supportEmail}`)} style={{ color: colors.green, fontWeight: "700" }}>
      {LEGAL_ENTITY.supportEmail}
    </Text>
  );

  return (
    <StaticPageLayout title="Privacy Policy" updated="27 September 2026">
      <PageSection heading="Who processes your data">
        <P>
          {entityOperatorSentence()} {LEGAL_ENTITY.legalName} is the data fiduciary responsible for the personal
          data described in this policy. It applies to the Bhavano website (bhavano.com) and the Bhavano apps for
          Android and iOS (together, the &ldquo;Platform&rdquo;).
        </P>
        {addressLines.length > 0 && (
          <Text style={{ fontSize: 13.5, color: colors.textSoft }}>
            <Text style={{ color: colors.muted }}>Registered office: </Text>
            {addressLines.join(", ")}
          </Text>
        )}
        <P>Privacy and grievance queries: {mail}.</P>
      </PageSection>

      <PageSection heading="1. Information we collect">
        <P>We collect the following information:</P>
        <View style={{ gap: 6 }}>
          <Bullet>
            {b("Account information:")} your phone number (verified by a one-time code), and/or the name and email
            address from your Google or Apple account if you sign in with one. If you use Sign in with Apple and
            choose to hide your email, we receive Apple&rsquo;s private relay address instead.
          </Bullet>
          <Bullet>
            {b("Profile information:")} your name, city, and a verified email address or phone number, which we ask
            for after you first log in. You can review and change these on your{" "}
            <PageLink href="/account">profile</PageLink>.
          </Bullet>
          <Bullet>
            {b("Listing content:")} anything you include in an ad you post, such as title, price, description,
            location, category-specific details, and the photos and videos you upload. In the app, we only access
            the photos or videos you pick from your device&rsquo;s library. We do not browse the rest of your
            library.
          </Bullet>
          <Bullet>
            {b("Activity on the Platform:")} the listings you view or favourite, messages you send and receive
            through Bhavano&rsquo;s messaging feature, contact details you unlock, saved searches, and property
            requirements you post (including whether you agreed to let us share your number with matching owners).
          </Bullet>
          <Bullet>
            {b("Purchases:")} what you bought (for example a Boost, Instant Alerts, contact-unlock credits or a
            subscription), the amount, and whether the payment succeeded. Card, UPI and bank details are entered
            directly with our payment processor, Razorpay. We never receive or store them.
          </Bullet>
          <Bullet>
            {b("Device and notification data:")} if you allow notifications in the app, a push notification token
            for your device, so we can alert you about new messages and activity on your listings. We also record
            whether you are using a desktop, mobile browser, tablet or the app.
          </Bullet>
          <Bullet>
            {b("Technical data:")} your IP address, the page you first arrived on, and the pages or screens you visit
            during that session, to investigate abuse and understand how people use the Platform. We derive an
            approximate city, region and country from your IP address using a local lookup database. This is a
            coarse estimate used only for our own internal reporting, never to choose what you see.
          </Bullet>
          <Bullet>
            {b("Advertising attribution:")} if you reach Bhavano by clicking one of our Google ads, we store the ad
            click identifier and the campaign source with your account, so we can tell which ads lead to sign-ups,
            listings and purchases.
          </Bullet>
          <Bullet>
            {b("Location data:")} precise location is only collected if you tap &ldquo;Auto-detect my current
            location&rdquo;, or drop a pin on the map while posting an ad. Your device asks your permission first.
            If you agree, your coordinates are sent to our servers and from there to Google&rsquo;s mapping
            services, solely to work out the city and area (and, for an ad, to show its location). We do not track
            your location in the background.
          </Bullet>
        </View>
      </PageSection>

      <PageSection heading="2. How we use this information">
        <P>We use the information above to:</P>
        <View style={{ gap: 4 }}>
          <Bullet>create your account, authenticate you and keep your account secure;</Bullet>
          <Bullet>show you listings relevant to your city;</Bullet>
          <Bullet>display your listings to other users and let them contact you about them;</Bullet>
          <Bullet>deliver messages between users, and maintain your favourites, saved searches and history;</Bullet>
          <Bullet>
            send you notifications (in-app, push, SMS, WhatsApp or email) about your account, your listings,
            messages, matching properties, and purchases;
          </Bullet>
          <Bullet>process payments and keep records of them, including for tax and accounting;</Bullet>
          <Bullet>
            occasionally tell you about paid features for your own listings, such as Boost. To stop these, contact
            us;
          </Bullet>
          <Bullet>understand how the Platform is used and measure how well our advertising works;</Bullet>
          <Bullet>moderate content, prevent fraud and abuse, and enforce our Terms of Service.</Bullet>
        </View>
      </PageSection>

      <PageSection heading="3. Who we share it with">
        <P>We do not sell your personal information. We share it only as follows:</P>
        <View style={{ gap: 6 }}>
          <Bullet>
            {b("Other users:")} your listings are public. Your name and the contact details you choose to share
            become visible to another user once you message each other about a listing, or once they unlock your
            listing&rsquo;s contact details.
          </Bullet>
          <Bullet>{b("Service providers")} that run parts of the Platform for us, only for that purpose:</Bullet>
          <Bullet indent>cloud hosting and database (Amazon Web Services, India);</Bullet>
          <Bullet indent>photo and video storage and delivery (Cloudflare);</Bullet>
          <Bullet indent>payments (Razorpay);</Bullet>
          <Bullet indent>sign-in (Google, Apple);</Bullet>
          <Bullet indent>one-time codes, SMS and WhatsApp messages (MSG91, Meta&rsquo;s WhatsApp Business Platform);</Bullet>
          <Bullet indent>email (Zoho Mail);</Bullet>
          <Bullet indent>
            push notifications (Expo, which delivers through Google Firebase Cloud Messaging and Apple Push
            Notification service);
          </Bullet>
          <Bullet indent>maps and location lookup (Google Maps Platform).</Bullet>
          <Bullet>
            {b("Advertising and analytics (Google):")} when you sign up, post an ad or make a purchase after clicking
            one of our Google ads, we send Google Ads the ad click identifier together with your email address
            and/or phone number in hashed (one-way encrypted) form, so Google can attribute that result to the ad.
            On iOS we only do this if you allow tracking when the app asks. See also section 4.
          </Bullet>
          <Bullet>
            {b("Legal and safety:")} where required by law, court order or a government authority, or to protect the
            rights and safety of our users and the Platform.
          </Bullet>
        </View>
        <P>
          Some of these providers may process data outside India. When they do, it is under their own security and
          privacy commitments.
        </P>
      </PageSection>

      <PageSection heading="4. Cookies, analytics and advertising">
        <P>
          On the website, we use a session cookie to keep you signed in and a cookie that remembers the city you last
          browsed. The website also loads Google Tag Manager, which runs Google&rsquo;s analytics and advertising
          measurement tags (Google Analytics and Google Ads). These may set cookies that measure visits and link a
          sign-up or purchase back to the ad that led to it. You can block or delete cookies in your browser
          settings.
        </P>
        <P>
          In the apps, your session is stored securely on your device instead of in a cookie. The apps do not use
          your device&rsquo;s advertising ID.
        </P>
      </PageSection>

      <PageSection heading="5. Listings from public business information">
        <P>
          Some PG and coworking listings are created from publicly available business information, such as business
          listings on Google Maps. We may contact that business on its public phone number (for example on
          WhatsApp) so the owner can claim, correct or remove the listing. To have such a listing removed, contact
          us.
        </P>
      </PageSection>

      <PageSection heading="6. Data retention">
        <P>
          We keep your account and listing data for as long as your account is active. Listings expire automatically
          after their posting period, and you can deactivate a listing yourself at any time from{" "}
          <PageLink href="/my-listings">My listings</PageLink>. When you delete your account, we remove your
          personal details as described in section 7. Payment records are kept for as long as tax and accounting
          law requires.
        </P>
      </PageSection>

      <PageSection heading="7. Deleting your account">
        <P>You can delete your Bhavano account at any time:</P>
        <View style={{ gap: 4 }}>
          <Bullet>
            {b("In the app:")} open <PageLink href="/account">Account</PageLink>, then tap &ldquo;Delete my
            account&rdquo;.
          </Bullet>
          <Bullet>{b("On the website:")} sign in, open your profile, and choose &ldquo;Delete my account&rdquo;.</Bullet>
          <Bullet>
            {b("By email:")} if you can no longer sign in, write to {mail} from the email address, or mentioning the
            phone number, on your account.
          </Bullet>
        </View>
        <P>
          Deleting your account immediately removes your name, phone number, email address, linked Google or Apple
          sign-in, city, advertising attribution and saved searches, and takes all your listings offline. We keep a
          record of past payments with your personal details removed, for tax and accounting purposes. Messages you
          already sent stay in the other person&rsquo;s conversation, no longer linked to your identity.
        </P>
      </PageSection>

      <PageSection heading="8. Your rights">
        <P>
          You can review and update your name, city and contact details at any time from your{" "}
          <PageLink href="/account">profile page</PageLink>, and turn off push notifications in your device
          settings. To ask for a copy of your data, correct it, or raise a grievance, contact us using the details
          below. We will respond within the time required by applicable law, including India&rsquo;s Digital
          Personal Data Protection Act, 2023.
        </P>
      </PageSection>

      <PageSection heading="9. Security">
        <P>
          All data sent between your device and our servers is encrypted in transit (HTTPS). We take reasonable
          technical and organisational measures to protect your information, but no method of transmission or
          storage is completely secure, and we cannot guarantee absolute security.
        </P>
      </PageSection>

      <PageSection heading="10. Children's privacy">
        <P>Bhavano is not directed at children under 18, and we do not knowingly collect their data.</P>
      </PageSection>

      <PageSection heading="11. Changes to this policy">
        <P>
          We may update this Privacy Policy from time to time. We&rsquo;ll update the &ldquo;Last updated&rdquo;
          date above when we do.
        </P>
      </PageSection>

      <PageSection heading="12. Contact">
        <P>
          Questions about this policy, or a request about your data? Email {mail} or use our{" "}
          <PageLink href="/contact">contact page</PageLink>.
        </P>
      </PageSection>
    </StaticPageLayout>
  );
}
