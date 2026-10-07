import { Fragment } from "react";
import { Text, View, type TextStyle } from "react-native";
import { parseListingDescription } from "@bhavano/types/listingDescriptionFormat";

/** Mobile's own copy of web's ListingDescription — same parseListingDescription, RN
 * Text/View instead of DOM. Renders the limited formatting the AI "Generate" assist is
 * instructed to produce: paragraph breaks, **bold** highlights, "- " bullets. A hand-typed
 * description with no markdown-ish syntax parses as one plain paragraph, so this is a drop-in
 * replacement for the old plain <Text> — nothing changes for text that never uses the
 * convention. RN has no native <ul>, so a bullet item is its own row: a "•" glyph column plus
 * the item's text, matching how MessageBody handles RN's lack of DOM-only features. */
export function ListingDescription({ text, style }: { text: string; style?: TextStyle }) {
  const blocks = parseListingDescription(text);
  return (
    <View>
      {blocks.map((block, blockIndex) => {
        if (block.type === "bullets") {
          return (
            <View key={blockIndex} style={{ marginBottom: 8 }}>
              {block.items.map((runs, itemIndex) => (
                <View key={itemIndex} style={{ flexDirection: "row", marginBottom: 4 }}>
                  <Text style={[style, { width: 16 }]}>{"•"}</Text>
                  <Text style={[style, { flex: 1 }]}>
                    {runs.map((run, runIndex) => (
                      <Text key={runIndex} style={run.bold ? { fontWeight: "700" } : undefined}>
                        {run.text}
                      </Text>
                    ))}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={blockIndex} style={[style, { marginBottom: 8 }]}>
            {block.runs.map((run, runIndex) => (
              <Text key={runIndex} style={run.bold ? { fontWeight: "700" } : undefined}>
                {run.text}
              </Text>
            ))}
          </Text>
        );
      })}
    </View>
  );
}
