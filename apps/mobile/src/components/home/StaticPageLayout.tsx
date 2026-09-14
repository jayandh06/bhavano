import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { ScreenHeader } from "./ScreenHeader";

/** Shared shell for the legal/help screens (About, Terms, Privacy, Contact, Help) — mirrors the
 * website's own StaticPageLayout/PageSection, content duplicated here (not loaded from a
 * WebView) since adding one is a new native dependency needing a fresh EAS dev-client build.
 * Entity-derived text (name, address, support email) comes from the shared
 * `@bhavano/types/legalEntity` module both apps already import, so only the surrounding prose
 * can drift between platforms — never the registered-entity facts themselves. */
export function StaticPageLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={title} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        {updated && (
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 18 }}>Last updated: {updated}</Text>
        )}
        <View style={{ gap: 22 }}>{children}</View>
      </ScrollView>
    </View>
  );
}

export function PageSection({ heading, children }: { heading: string; children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 8 }}>{heading}</Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

/** A paragraph in the body copy style every section uses. */
export function P({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return <Text style={{ fontSize: 13.5, lineHeight: 21, color: colors.textSoft }}>{children}</Text>;
}

/** An in-line link to another route in this same set of pages — nested `<Text onPress>` inside
 * a paragraph's `<Text>`, same as the website's inline `<Link>`. */
export function PageLink({ href, children }: { href: Href; children: ReactNode }) {
  const { colors } = useAppTheme();
  const router = useRouter();
  return (
    <Text onPress={() => router.push(href)} style={{ color: colors.green, fontWeight: "700" }}>
      {children}
    </Text>
  );
}
