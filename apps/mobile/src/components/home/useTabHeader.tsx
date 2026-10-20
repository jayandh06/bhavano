import { useCallback, useState, type ReactNode } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { BrandHeader } from "./BrandHeader";
import { CategoryChips } from "./CategoryChips";
import { CollapsedHeaderBar } from "./CollapsedHeaderBar";
import { HomeDrawer } from "./HomeDrawer";

/** Scrolled past this, the full header has gone and the slim bar takes over — same as Home. */
const COLLAPSE_THRESHOLD = 80;

/** Home's header behaviour for the screens that share its tab strip (Requirements, Blog): the full
 * header and strip sit at the top of the scrolling content, and once scrolled past them the slim
 * bar (menu, logo, Post ad) overlays the top, with the drawer behind its menu button.
 *
 * Put `header` first inside the screen's scrolling content, pass `onScroll` to that scroller, and
 * render `overlay` as a sibling of it inside a `flex: 1` container. */
export function useTabHeader(active: "requirements" | "blog"): {
  header: ReactNode;
  overlay: ReactNode;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
} {
  const { theme, toggleTheme } = useAppTheme();
  const router = useRouter();
  const { city, openLocationPicker, requireLogin, isLoggedIn, profile, logout } = useHomeSheets();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // A tab stays mounted when left, so start each visit from the full header; the next scroll
  // event puts the slim bar back if the list is still scrolled.
  useFocusEffect(
    useCallback(() => {
      setCollapsed(false);
      setMenuOpen(false);
    }, []),
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setCollapsed(y > COLLAPSE_THRESHOLD);
  };

  return {
    header: (
      <>
        <BrandHeader />
        <CategoryChips active={active} />
      </>
    ),
    onScroll,
    overlay: (
      <>
        {collapsed && (
          <CollapsedHeaderBar onOpenMenu={() => setMenuOpen(true)} onPostAd={() => router.push("/post")} />
        )}
        <HomeDrawer
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          city={city}
          onOpenLocationPicker={openLocationPicker}
          activeCategory={null}
          onSelectCategory={(value) =>
            router.navigate({ pathname: "/", params: { category: value, t: String(Date.now()) } })
          }
          isLoggedIn={isLoggedIn}
          userName={profile?.name}
          onLogin={() => requireLogin()}
          onLogout={() => void logout()}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </>
    ),
  };
}
