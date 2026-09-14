import { Linking, Text, View } from "react-native";
import { LEGAL_ENTITY, entityAddressLines, entityOperatorSentence } from "@bhavano/types/legalEntity";
import { useAppTheme } from "../src/theme/ThemeContext";
import { P, PageLink, PageSection, StaticPageLayout } from "../src/components/home/StaticPageLayout";

// Mirrors apps/web/src/app/about/page.tsx — see StaticPageLayout's own note on why this is
// duplicated rather than loaded from the live page.
export default function AboutScreen() {
  const { colors } = useAppTheme();
  const addressLines = entityAddressLines();

  return (
    <StaticPageLayout title="About us" updated="26 August 2026">
      <PageSection heading="Who we are">
        <P>
          {entityOperatorSentence()} Bhavano is a classifieds marketplace where people browse, post, buy, sell,
          rent or lease houses, apartments, villas, plots, PG accommodation, storage space, coworking desks,
          commercial spaces and furniture across India — with no login needed to browse.
        </P>
      </PageSection>

      <PageSection heading="Legal entity">
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 13.5, color: colors.textSoft }}>
            <Text style={{ color: colors.muted }}>Registered name: </Text>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{LEGAL_ENTITY.legalName}</Text>
          </Text>
          <Text style={{ fontSize: 13.5, color: colors.textSoft }}>
            <Text style={{ color: colors.muted }}>Brand: </Text>
            {LEGAL_ENTITY.brand} (bhavano.com and the Bhavano mobile app)
          </Text>
          {LEGAL_ENTITY.llpin && (
            <Text style={{ fontSize: 13.5, color: colors.textSoft }}>
              <Text style={{ color: colors.muted }}>LLPIN: </Text>
              {LEGAL_ENTITY.llpin}
            </Text>
          )}
          {LEGAL_ENTITY.gstin && (
            <Text style={{ fontSize: 13.5, color: colors.textSoft }}>
              <Text style={{ color: colors.muted }}>GSTIN: </Text>
              {LEGAL_ENTITY.gstin}
            </Text>
          )}
        </View>
      </PageSection>

      {addressLines.length > 0 && (
        <PageSection heading="Registered office">
          <View>
            {addressLines.map((line) => (
              <Text key={line} style={{ fontSize: 13.5, color: colors.textSoft }}>
                {line}
              </Text>
            ))}
          </View>
        </PageSection>
      )}

      <PageSection heading="Contact">
        <P>
          Email us at{" "}
          <Text onPress={() => Linking.openURL(`mailto:${LEGAL_ENTITY.supportEmail}`)} style={{ color: colors.green, fontWeight: "700" }}>
            {LEGAL_ENTITY.supportEmail}
          </Text>
          {LEGAL_ENTITY.supportPhone && (
            <>
              {" "}
              or call{" "}
              <Text
                onPress={() => Linking.openURL(`tel:${LEGAL_ENTITY.supportPhone?.replace(/\s/g, "")}`)}
                style={{ color: colors.green, fontWeight: "700" }}
              >
                {LEGAL_ENTITY.supportPhone}
              </Text>
            </>
          )}
          . For anything else, see our <PageLink href="/contact">Contact page</PageLink> or the{" "}
          <PageLink href="/help">Help centre</PageLink>.
        </P>
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
