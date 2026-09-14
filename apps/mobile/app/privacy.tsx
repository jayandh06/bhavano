import { Linking, Text, View } from "react-native";
import { LEGAL_ENTITY, entityAddressLines, entityOperatorSentence } from "@bhavano/types/legalEntity";
import { useAppTheme } from "../src/theme/ThemeContext";
import { P, PageLink, PageSection, StaticPageLayout } from "../src/components/home/StaticPageLayout";

function Bullet({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <Text style={{ fontSize: 13.5, color: colors.textSoft }}>{"•"}</Text>
      <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 21, color: colors.textSoft }}>{children}</Text>
    </View>
  );
}

// Mirrors apps/web/src/app/privacy/page.tsx — see StaticPageLayout's own note on why this is
// duplicated rather than loaded from the live page.
export default function PrivacyScreen() {
  const { colors } = useAppTheme();
  const addressLines = entityAddressLines();

  return (
    <StaticPageLayout title="Privacy Policy" updated="1 September 2026">
      <PageSection heading="Who processes your data">
        <P>
          {entityOperatorSentence()} {LEGAL_ENTITY.legalName} is the data fiduciary responsible for the personal
          data described in this policy.
        </P>
        {addressLines.length > 0 && (
          <Text style={{ fontSize: 13.5, color: colors.textSoft }}>
            <Text style={{ color: colors.muted }}>Registered office: </Text>
            {addressLines.join(", ")}
          </Text>
        )}
        <P>
          Privacy and grievance queries:{" "}
          <Text onPress={() => Linking.openURL(`mailto:${LEGAL_ENTITY.supportEmail}`)} style={{ color: colors.green, fontWeight: "700" }}>
            {LEGAL_ENTITY.supportEmail}
          </Text>
          .
        </P>
      </PageSection>

      <PageSection heading="1. Information we collect">
        <P>We collect the following information:</P>
        <View style={{ gap: 6 }}>
          <Bullet>
            <Text style={{ fontWeight: "700", color: colors.text }}>Account information:</Text> your phone number
            (verified via OTP) or, if you sign in with Google, your Google account name and email address.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "700", color: colors.text }}>Profile information:</Text> your name and
            city/state, if you choose to add them on your <PageLink href="/account">profile</PageLink>. Your city
            can be auto-detected from your device&rsquo;s location, which you can review and change before
            saving — it is never saved automatically.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "700", color: colors.text }}>Listing content:</Text> anything you include
            in an ad you post — title, price, description, photos, and category-specific details.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "700", color: colors.text }}>Usage data:</Text> which listings you view or
            favourite, and messages you send through the Platform&rsquo;s messaging feature.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "700", color: colors.text }}>Technical data:</Text> your IP address and the
            page you first arrived on, recorded once per browsing session, to investigate abuse and understand how
            visitors reach the Platform. We also derive an approximate city, region, and country from that IP
            address using a local lookup database — this is a coarse estimate (it can be wrong, particularly on
            mobile networks) used only for our own internal reporting, and never to choose what you see on the
            Platform.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "700", color: colors.text }}>Location data:</Text> precise location is only
            ever collected if you tap &ldquo;Auto-detect my current location&rdquo; in the location selector.
            Your device asks your permission first; if you agree, your coordinates are sent to our servers and
            from there to Google&rsquo;s geocoding service, solely to work out which city and area you are in.
            Other than the coarse, IP-based estimate described above, we do not otherwise track or store your
            location, and you can always pick a city yourself from the same selector instead.
          </Bullet>
        </View>
      </PageSection>

      <PageSection heading="2. How we use this information">
        <P>We use the information above to:</P>
        <View style={{ gap: 4 }}>
          <Bullet>authenticate you and keep your account secure;</Bullet>
          <Bullet>show you listings relevant to your city and pre-fill it as a convenience on your profile;</Bullet>
          <Bullet>display your listings to other users and let them contact you about them;</Bullet>
          <Bullet>show view/favourite counts on listings, and maintain your favourites and message history;</Bullet>
          <Bullet>moderate content and enforce our Terms of Service.</Bullet>
        </View>
      </PageSection>

      <PageSection heading="3. What we share">
        <P>
          We do not sell your personal information. Your name and the contact details you choose to share are
          visible to another user once you message them (or they message you) about a specific listing, or once
          they unlock your listing&rsquo;s contact details (a free allowance, then a paid credit — see the listing
          posting flow for details). We may share information with service providers that host our infrastructure
          (database, file storage) solely to operate the Platform, and where required by law.
        </P>
      </PageSection>

      <PageSection heading="4. Cookies and sessions">
        <P>
          On the website, we use a session cookie to keep you signed in, and a cookie that remembers which city
          you last browsed. In the app, the equivalent session token is stored on your device. We do not use
          third-party advertising or tracking cookies.
        </P>
      </PageSection>

      <PageSection heading="5. Data retention">
        <P>
          We retain your account and listing data for as long as your account is active. Listings automatically
          expire after a fixed posting period; you can also deactivate a listing yourself at any time from{" "}
          <PageLink href="/my-listings">My listings</PageLink>.
        </P>
      </PageSection>

      <PageSection heading="6. Your rights">
        <P>
          You can review and update your name and city at any time from your{" "}
          <PageLink href="/account">profile page</PageLink>. To request a copy of your data, or to have your
          account and data deleted, use the &ldquo;Delete my account&rdquo; option on your profile, or{" "}
          <PageLink href="/contact">contact us</PageLink>.
        </P>
      </PageSection>

      <PageSection heading="7. Security">
        <P>
          We take reasonable technical measures to protect your information, but no method of transmission or
          storage is completely secure, and we cannot guarantee absolute security.
        </P>
      </PageSection>

      <PageSection heading="8. Children's privacy">
        <P>Bhavano is not directed at children under 18, and we do not knowingly collect their data.</P>
      </PageSection>

      <PageSection heading="9. Changes to this policy">
        <P>
          We may update this Privacy Policy from time to time. We&rsquo;ll update the &ldquo;Last updated&rdquo;
          date above when we do.
        </P>
      </PageSection>

      <PageSection heading="10. Contact">
        <P>
          Questions about this policy, or a request to access/delete your data? Reach us at{" "}
          <PageLink href="/contact">Contact us</PageLink>.
        </P>
      </PageSection>
    </StaticPageLayout>
  );
}
