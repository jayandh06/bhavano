import { Linking, Pressable, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { LEGAL_ENTITY, entityAddressLines } from "@bhavano/types/legalEntity";
import { useAppTheme } from "../src/theme/ThemeContext";
import { P, PageLink, PageSection, StaticPageLayout } from "../src/components/home/StaticPageLayout";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bhavano.com";

// Mirrors apps/web/src/app/contact/page.tsx's static sections — the actual support-ticket form
// (attachments, spam honeypot, topic routing) isn't ported here; it's a real submission feature
// in its own right, not static content, so "Send us a message" opens the website's form instead.
export default function ContactScreen() {
  const { colors } = useAppTheme();
  const addressLines = entityAddressLines();

  return (
    <StaticPageLayout title="Contact us" updated="26 August 2026">
      <PageSection heading="Registered entity">
        <P>
          Bhavano is operated by <Text style={{ color: colors.text, fontWeight: "700" }}>{LEGAL_ENTITY.legalName}</Text>
          {LEGAL_ENTITY.llpin && <> (LLPIN: {LEGAL_ENTITY.llpin})</>}.
        </P>
        {addressLines.length > 0 && (
          <Text style={{ fontSize: 13.5, color: colors.textSoft }}>
            <Text style={{ color: colors.muted }}>Registered office: </Text>
            {addressLines.join(", ")}
          </Text>
        )}
        {LEGAL_ENTITY.supportPhone && (
          <Text style={{ fontSize: 13.5, color: colors.textSoft }}>
            <Text style={{ color: colors.muted }}>Phone: </Text>
            <Text
              onPress={() => Linking.openURL(`tel:${LEGAL_ENTITY.supportPhone?.replace(/\s/g, "")}`)}
              style={{ color: colors.green, fontWeight: "700" }}
            >
              {LEGAL_ENTITY.supportPhone}
            </Text>
          </Text>
        )}
      </PageSection>

      <PageSection heading="Get in touch">
        <P>
          Have a question, need help with your account, or want to report a listing? Check our{" "}
          <PageLink href="/help">Help centre</PageLink> first — if that doesn&rsquo;t answer it, send us the
          details and we&rsquo;ll get back to you as soon as we can. Prefer email? Write to{" "}
          <Text onPress={() => Linking.openURL(`mailto:${LEGAL_ENTITY.supportEmail}`)} style={{ color: colors.green, fontWeight: "700" }}>
            {LEGAL_ENTITY.supportEmail}
          </Text>
          .
        </P>
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/contact`)}
          style={{ borderWidth: 1.5, borderColor: colors.green, borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 4 }}
        >
          <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>Send us a message</Text>
        </Pressable>
      </PageSection>

      <PageSection heading="What to include">
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13.5, lineHeight: 21, color: colors.textSoft }}>
            {"•"} Account or login issues — the phone number or email your account uses.
          </Text>
          <Text style={{ fontSize: 13.5, lineHeight: 21, color: colors.textSoft }}>
            {"•"} Reporting a listing — a link to the listing (or its title and city) and what&rsquo;s wrong
            with it.
          </Text>
          <Text style={{ fontSize: 13.5, lineHeight: 21, color: colors.textSoft }}>
            {"•"} Privacy requests — see our <PageLink href="/privacy">Privacy Policy</PageLink> for what you
            can ask us to access or delete.
          </Text>
          <Text style={{ fontSize: 13.5, lineHeight: 21, color: colors.textSoft }}>
            {"•"} Anything else — general feedback, partnership queries, or bug reports.
          </Text>
        </View>
      </PageSection>

      <PageSection heading="Legal">
        <P>
          Read our <PageLink href="/terms">Terms of Service</PageLink> and{" "}
          <PageLink href="/privacy">Privacy Policy</PageLink>.
        </P>
      </PageSection>
    </StaticPageLayout>
  );
}
