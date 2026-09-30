import { Linking, Text, type TextStyle } from "react-native";
import { router, type Href } from "expo-router";
import { bhavanoSitePath, normalizeUrlForOpening, segmentMessageBody } from "@bhavano/types/messageFormat";

/** bhavano.com pages that have an app screen, so a link to one opens in the app (already logged
 * in) instead of the browser. Keyed by the website path. */
const APP_SCREEN_FOR_SITE_PATH: Record<string, Href> = {
  "/": "/",
  "/my-listings": "/my-listings",
  "/messages": "/messages",
  "/favourites": "/saved",
  "/my-requirements": "/my-requirements",
  "/plans": "/plans",
  "/purchases": "/purchases",
  "/help": "/help",
  "/contact": "/contact",
  "/about": "/about",
  "/privacy": "/privacy",
  "/terms": "/terms",
};

function openLink(url: string) {
  const sitePath = bhavanoSitePath(url)?.split(/[?#]/)[0].replace(/(.)\/$/, "$1");
  const screen = sitePath ? APP_SCREEN_FOR_SITE_PATH[sitePath] : undefined;
  if (screen) router.push(screen);
  else void Linking.openURL(normalizeUrlForOpening(url)).catch(() => undefined);
}

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
          <Text key={index} style={{ textDecorationLine: "underline" }} onPress={() => openLink(segment.value)}>
            {segment.value}
          </Text>
        ) : (
          <Text key={index}>{segment.value}</Text>
        ),
      )}
    </Text>
  );
}
