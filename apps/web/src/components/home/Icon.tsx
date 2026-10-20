import { ICON_PATHS } from "./iconPaths.generated";

/**
 * The app's icons: one stroke weight, no fill, `currentColor`.
 *
 * These were emoji. Emoji are a different design system on every platform — Apple's are glossy
 * and three-dimensional, Google's are flat and saturated, Windows' are something else again — so
 * the same page looked like a different product depending on the device, and no amount of styling
 * on our side could reach them. They also ignore the theme completely: a 📍 stays the same
 * primary red on a dark page as on a light one, and sits next to text it can never match.
 *
 * `currentColor` is the whole point of the replacement. An icon now takes the colour of whatever
 * it sits in — muted next to muted text, green inside a green button — and follows the theme
 * without anyone maintaining a second palette.
 *
 * Sized in `em` rather than pixels, so an icon scales with the text beside it instead of needing
 * a size at every call site.
 */
/** Narrows a name that crossed a package boundary as a plain string — `iconName` on the shared
 * category data, which cannot reference this file. An unknown name renders nothing rather than
 * throwing, so a category added to the types package without an icon here degrades to no icon
 * rather than a blank page. */
export function isIconName(value: string | undefined): value is IconName {
  return value !== undefined && value in ICON_PATHS;
}

export type IconName = keyof typeof ICON_PATHS;

export function Icon({
  name,
  className = "",
  /** Fills the shape as well as stroking it — only for the favourite heart, where "on" has to
   * read at a glance and an outline alone does not. */
  filled = false,
  label,
}: {
  name: IconName;
  className?: string;
  filled?: boolean;
  label?: string;
}) {
  // Only the shapes are emitted per icon; the viewBox is the one attribute an inline <svg> cannot get from CSS,
  // and everything else (1em size, stroke, weight, caps, vertical alignment) is the shared `.ic` class in
  // globals.css. That is what took ~93 KB of repeated attributes out of the homepage HTML — see
  // scripts/generate-icon-paths.mjs. 1.75 stroke rather than lucide's default 2, which reads heavy at the
  // 13-15px this app mostly uses; 1em so it matches whatever text it sits beside.
  return (
    <svg
      viewBox="0 0 24 24"
      className={`ic${filled ? " ic-filled" : ""}${className ? ` ${className}` : ""}`}
      // Decorative by default: almost every icon here sits beside its own label, and a screen
      // reader announcing "map pin Koramangala, Bengaluru" is worse than announcing the text.
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}
