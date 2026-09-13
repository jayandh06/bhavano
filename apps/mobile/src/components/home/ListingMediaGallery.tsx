import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { ListingVideoDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";

export type MediaItem =
  | { kind: "photo"; url: string }
  | { kind: "video"; url: string; posterUrl: string; durationSec: number };

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Mirrors the website's `ListingMediaGallery.tsx`: a hero + thumbnail strip sharing one selected
 * index, photos first then videos (only ever `status: "done"` — the BFF already filters this for
 * a non-owner/non-admin viewer). One deliberate gap from web: no full-screen lightbox (web's
 * `MediaLightbox`) and no inline `<video>` player — this app has no video-playback native module
 * (`expo-av`/`expo-video`), and adding one is a new native dependency needing a fresh EAS
 * dev-client build, not something to pull in just for this. A picked video's hero slot shows its
 * poster + a "Play video" button that opens the real video file in the system/in-app browser
 * instead — genuinely playable, just not embedded in the scroll view.
 */
export function ListingMediaGallery({
  photosFull,
  videos,
  title,
  tag,
  isExpired,
  imgColors,
  imgLabel,
}: {
  photosFull: string[];
  videos: ListingVideoDto[];
  title: string;
  tag: string;
  isExpired: boolean;
  /** Fallback background/caption for the rare listing with no media at all — mirrors the
   * website's own defensive handling of the same case. */
  imgColors: [string, string];
  imgLabel: string;
}) {
  const { colors } = useAppTheme();
  const items: MediaItem[] = [
    ...photosFull.map((url): MediaItem => ({ kind: "photo", url })),
    ...videos.map((v): MediaItem => ({ kind: "video", url: v.url, posterUrl: v.posterUrl, durationSec: v.durationSec })),
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex];

  return (
    <View>
      <View style={[styles.hero, { backgroundColor: active ? colors.surfaceAlt : imgColors[0] }]}>
        {!active && <Text style={styles.imageCaption}>{imgLabel}</Text>}
        {active?.kind === "photo" && (
          <Image source={{ uri: active.url }} style={StyleSheet.absoluteFill} accessibilityLabel={title} />
        )}
        {active?.kind === "video" && (
          <>
            <Image source={{ uri: active.posterUrl }} style={StyleSheet.absoluteFill} />
            <View style={styles.videoScrim} />
            <Pressable
              onPress={() => WebBrowser.openBrowserAsync(active.url)}
              style={[styles.playButton, { backgroundColor: colors.surface }]}
            >
              <Icon name="video" size={22} color={colors.green} />
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13 }}>Play video</Text>
            </Pressable>
          </>
        )}
        <View style={[styles.tag, { backgroundColor: colors.green }]}>
          <Text style={{ color: colors.onGreen, fontSize: 11, fontWeight: "700" }}>{tag}</Text>
        </View>
        {isExpired && (
          <View style={styles.expiredTag}>
            <Text style={{ color: "#F5F1E6", fontSize: 11, fontWeight: "700" }}>Expired</Text>
          </View>
        )}
      </View>

      {items.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
          {items.map((item, i) => (
            <Pressable
              key={item.kind === "photo" ? item.url : item.url + item.posterUrl}
              onPress={() => setActiveIndex(i)}
              accessibilityLabel={`${title} ${item.kind} ${i + 1}`}
              style={[styles.thumb, i === activeIndex && { borderColor: colors.green, borderWidth: 2 }]}
            >
              <Image source={{ uri: item.kind === "photo" ? item.url : item.posterUrl }} style={StyleSheet.absoluteFill} />
              {item.kind === "video" && (
                <>
                  <View style={styles.thumbPlayScrim}>
                    <Text style={{ color: "#fff", fontSize: 16 }}>▶</Text>
                  </View>
                  <View style={styles.durationChip}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{formatDuration(item.durationSec)}</Text>
                  </View>
                </>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 240, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  imageCaption: {
    fontSize: 12,
    color: "#ffffffcc",
    backgroundColor: "#00000030",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  videoScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#00000055" },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
  },
  tag: { position: "absolute", top: 12, left: 12, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  expiredTag: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#242420",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  thumbRow: { gap: 8, paddingVertical: 10 },
  thumb: { width: 72, height: 72, borderRadius: 10, overflow: "hidden" },
  thumbPlayScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#00000033",
    alignItems: "center",
    justifyContent: "center",
  },
  durationChip: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#000000aa",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
});
