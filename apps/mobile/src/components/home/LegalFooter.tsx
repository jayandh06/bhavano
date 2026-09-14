import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { ENTITY_TAGLINE, entityCopyright } from "@bhavano/types/legalEntity";
import { useAppTheme } from "../../theme/ThemeContext";

const LEGAL_LINKS: { label: string; path: Href }[] = [
  { label: "About us", path: "/about" },
  { label: "Terms of Service", path: "/terms" },
  { label: "Privacy Policy", path: "/privacy" },
  { label: "Contact us", path: "/contact" },
];

/** Names the registered entity behind the Bhavano brand inside the app itself, mirroring the web
 * footer. The bundle id (`com.finfolia.bhavano`) already carries the entity, but that isn't
 * visible to a reviewer using the app — see docs/plans/finfolia-entity-disclosure.md. */
export function LegalFooter() {
  const { colors } = useAppTheme();
  const router = useRouter();

  return (
    <View style={{ marginTop: 36, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 12 }}>Legal</Text>

      {/* One line, not a stacked list — these push to the app's own native pages
          (StaticPageLayout) rather than opening a browser at all now. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 6, marginBottom: 18 }}>
        {LEGAL_LINKS.map((link, i) => (
          <View key={link.path.toString()} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => router.push(link.path)}>
              <Text style={{ fontSize: 13, color: colors.green, fontWeight: "600" }}>{link.label}</Text>
            </Pressable>
            {i < LEGAL_LINKS.length - 1 && <Text style={{ color: colors.border }}>·</Text>}
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>{ENTITY_TAGLINE}</Text>
      <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>{entityCopyright(2026)}</Text>
    </View>
  );
}
