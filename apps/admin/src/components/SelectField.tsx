import type { ReactNode, SelectHTMLAttributes } from "react";

/**
 * A `<select>` with the browser's native arrow replaced by a themed caret inset from the edge —
 * same problem and fix as the web app's SelectField (apps/web/src/components/home/SelectField.tsx):
 * the native arrow is pinned to the control's far right edge, so on a wide field holding a short
 * value ("Yes", "Active") it sits well away from the text and reads as belonging to nothing. A
 * wrapper span rather than a background-image on the select itself, since a data-URI SVG can't
 * pick up a CSS variable and this needs to follow the theme. `pointerEvents: "none"` on the caret
 * keeps the whole control (arrow included) clickable.
 */
export function SelectField({
  children,
  style,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div style={{ position: "relative", display: "inline-block", width: style?.width ?? "100%" }}>
      <select
        {...props}
        style={{
          ...style,
          width: "100%",
          appearance: "none",
          WebkitAppearance: "none",
          paddingRight: 28,
          cursor: props.disabled ? "default" : "pointer",
        }}
      >
        {children}
      </select>
      <span
        style={{
          pointerEvents: "none",
          position: "absolute",
          right: 11,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 11,
          color: "var(--muted)",
        }}
      >
        ▾
      </span>
    </div>
  );
}
