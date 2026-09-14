import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";
import { PageSection } from "./StaticPageLayout";

export interface Faq {
  q: string;
  a: ReactNode;
}

/** Mirrors the website's `<details>/<summary>` accordion — collapsed by default, one open at a
 * time isn't enforced (matches web, where multiple `<details>` can be open together). */
export function FaqGroup({ title, items }: { title: string; items: Faq[] }) {
  const { colors } = useAppTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <PageSection heading={title}>
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <View
            key={item.q}
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, backgroundColor: colors.surface }}
          >
            <Pressable
              onPress={() => setOpenIndex(open ? null : i)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text style={{ flex: 1, fontWeight: "700", fontSize: 13.5, color: colors.text }}>{item.q}</Text>
              <Icon name={open ? "chevronDown" : "chevronRight"} size={14} color={colors.muted} />
            </Pressable>
            {open && <Text style={{ marginTop: 10, fontSize: 13.5, lineHeight: 21, color: colors.textSoft }}>{item.a}</Text>}
          </View>
        );
      })}
    </PageSection>
  );
}
