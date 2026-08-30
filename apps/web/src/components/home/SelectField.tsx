import type { ReactNode, SelectHTMLAttributes } from "react";
import { fieldClass } from "@/lib/formStyles";

/**
 * A `<select>` with the browser's arrow replaced by a themed one.
 *
 * The native arrow is pinned to the far edge of the control, so on a full-width field holding a
 * short value — "Yes", "Unfurnished" — it sits an inch of empty space away from the text and
 * reads as belonging to nothing. It is also drawn in each browser's own grey, which is the one
 * part of a form that ignores the app's theme entirely and stays light-grey on a dark page.
 *
 * A wrapper rather than a background-image on the select itself: a data-URI SVG cannot pick up a
 * CSS variable, so a themed colour needs a real element. `pointer-events-none` on it keeps the
 * whole control clickable, arrow included.
 */
export function SelectField({
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className="relative">
      <select {...props} className={`${fieldClass} appearance-none pr-9 cursor-pointer ${className}`}>
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted">▾</span>
    </div>
  );
}
