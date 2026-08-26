import { Linking, Pressable, Text, View } from "react-native";
import { ENTITY_TAGLINE, entityCopyright } from "@bhavano/types/legalEntity";
import { useAppTheme } from "../../theme/ThemeContext";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bhavano.com";

const LEGAL_LINKS = [
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

  return (
    <View style={{ marginTop: 36, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 12 }}>Legal</Text>

      <View style={{ gap: 10, marginBottom: 18 }}>
        {LEGAL_LINKS.map((link) => (
          <Pressable key={link.path} onPress={() => Linking.openURL(`${SITE_URL}${link.path}`)}>
            <Text style={{ fontSize: 13.5, color: colors.green, fontWeight: "600" }}>{link.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>{ENTITY_TAGLINE}</Text>
      <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>{entityCopyright(2026)}</Text>
    </View>
  );
}
