import { useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";
import type { MediaItem } from "./ListingMediaGallery";

/**
 * Full-screen swipeable viewer for a listing's photos and videos — tapping the hero or a
 * thumbnail in `ListingMediaGallery` opens this at that item. Photos render full-bleed
 * (`resizeMode="contain"`); a video shows its poster plus the same "Play video" affordance the
 * hero itself used to have (opens the real file in the system/in-app browser) — this app still
 * has no video-playback native module (`expo-av`/`expo-video`), and adding one is a new native
 * dependency needing a fresh EAS dev-client build, not something to pull in just for this.
 *
 * `Modal` renders as its own top-level layer, above everything including the app's persistent
 * `BottomTabBar` — exactly right for a full-screen viewer, and it means safe-area insets need
 * re-applying here explicitly rather than inheriting them (see the same note on `HomeDrawer`).
 */
export function MediaLightbox({
  items,
  initialIndex,
  onClose,
  onIndexChange,
}: {
  items: MediaItem[];
  initialIndex: number;
  onClose: () => void;
  /** So the hero/thumbnail strip underneath reflects wherever the visitor ends up after
   * swiping, once they close this — otherwise it'd silently snap back to whatever was active
   * before they opened it. */
  onIndexChange?: (index: number) => void;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(initialIndex);

  function goTo(i: number) {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
    onIndexChange?.(i);
  }

  function onMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
    onIndexChange?.(i);
  }

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#0b0b0a" }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          contentOffset={{ x: initialIndex * width, y: 0 }}
        >
          {items.map((item) => (
            <View key={item.kind === "photo" ? item.url : item.url + item.posterUrl} style={{ width, height, alignItems: "center", justifyContent: "center" }}>
              {item.kind === "photo" ? (
                <Image source={{ uri: item.url }} style={{ width, height }} resizeMode="contain" />
              ) : (
                <>
                  <Image source={{ uri: item.posterUrl }} style={{ width, height }} resizeMode="contain" />
                  <View style={styles.videoScrim} />
                  <Pressable
                    onPress={() => WebBrowser.openBrowserAsync(item.url)}
                    style={[styles.playButton, { backgroundColor: colors.surface }]}
                  >
                    <Icon name="video" size={22} color={colors.green} />
                    <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>Play video</Text>
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </ScrollView>

        <Pressable
          onPress={onClose}
          accessibilityLabel="Close"
          style={[styles.closeButton, { top: insets.top + 12 }]}
        >
          <Icon name="close" size={20} color="#fff" />
        </Pressable>

        {items.length > 1 && (
          <>
            <View style={[styles.counter, { top: insets.top + 20 }]}>
              <Text style={styles.counterText}>
                {index + 1} / {items.length}
              </Text>
            </View>
            {index > 0 && (
              <Pressable
                onPress={() => goTo(index - 1)}
                accessibilityLabel="Previous"
                style={[styles.arrow, { left: 10, top: height / 2 - 22 }]}
              >
                <Icon name="chevronLeft" size={22} color="#fff" />
              </Pressable>
            )}
            {index < items.length - 1 && (
              <Pressable
                onPress={() => goTo(index + 1)}
                accessibilityLabel="Next"
                style={[styles.arrow, { right: 10, top: height / 2 - 22 }]}
              >
                <Icon name="chevronRight" size={22} color="#fff" />
              </Pressable>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  videoScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#00000055" },
  playButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24 },
  closeButton: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff1f",
    alignItems: "center",
    justifyContent: "center",
  },
  counter: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  counterText: { color: "#ffffffcc", fontWeight: "700", fontSize: 13 },
  arrow: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff1f",
    alignItems: "center",
    justifyContent: "center",
  },
});
