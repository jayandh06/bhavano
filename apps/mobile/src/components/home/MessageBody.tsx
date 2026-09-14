import { Linking, Text, type TextStyle } from "react-native";
import { normalizeUrlForOpening, segmentMessageBody } from "@bhavano/types/messageFormat";

// Nested <Text> inherits the outer style's color, so a linked segment reads correctly
// against either bubble color (the "mine" green or "theirs" surfaceAlt) with just an
// underline added — no separate link-color prop needed. Newlines in `body` need no
// handling here: RN's <Text> already preserves `\n` natively.
export function MessageBody({ body, style }: { body: string; style?: TextStyle }) {
  const segments = segmentMessageBody(body);
  return (
    <Text style={style}>
      {segments.map((segment, index) =>
        segment.type === "url" ? (
          <Text
            key={index}
            style={{ textDecorationLine: "underline" }}
            onPress={() => Linking.openURL(normalizeUrlForOpening(segment.value))}
          >
            {segment.value}
          </Text>
        ) : (
          <Text key={index}>{segment.value}</Text>
        ),
      )}
    </Text>
  );
}
