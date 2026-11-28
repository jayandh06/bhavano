import type { ThemeName } from "@bhavano/types/tokens";

/**
 * The website's faint diamond-trellis background (docs/plans/background-trellis.md): a 30pt tile of crossing diagonals with a five-dot
 * flower at each crossing. The website holds it as SVG data URIs in `apps/web/src/app/globals.css`; the numbers here are the same ones,
 * and trellis.spec.ts fails if the two drift apart.
 *
 * - `band`: the green strips (the utility bar and the bottom tab bar, the website's top bar and footer).
 * - `head`: the header rows on their light background.
 * - `body`: the page behind a screen's content.
 */
export type TrellisSurface = "band" | "head" | "body";

export interface TrellisPaint {
  stroke: string;
  strokeOpacity: number;
  fill: string;
  fillOpacity: number;
}

export const TRELLIS_SIZE = 30;
export const TRELLIS_PATH = "M0 0L30 30M30 0L0 30";
export const TRELLIS_STROKE_WIDTH = 0.6;
/** The flower: `[cx, cy, r]`, a middle dot and four petals. */
export const TRELLIS_DOTS: ReadonlyArray<readonly [number, number, number]> = [
  [15, 15, 1.6],
  [15, 11, 1.1],
  [15, 19, 1.1],
  [11, 15, 1.1],
  [19, 15, 1.1],
];

export const TRELLIS_PAINT: Record<ThemeName, Record<TrellisSurface, TrellisPaint>> = {
  light: {
    band: { stroke: "#04140d", strokeOpacity: 0.2, fill: "#04140d", fillOpacity: 0.26 },
    head: { stroke: "#0b3d2e", strokeOpacity: 0.06, fill: "#c9a15a", fillOpacity: 0.24 },
    body: { stroke: "#0b3d2e", strokeOpacity: 0.035, fill: "#c9a15a", fillOpacity: 0.08 },
  },
  dark: {
    band: { stroke: "#0e1710", strokeOpacity: 0.05, fill: "#0e1710", fillOpacity: 0.09 },
    head: { stroke: "#edeae0", strokeOpacity: 0.025, fill: "#d9b36b", fillOpacity: 0.09 },
    body: { stroke: "#edeae0", strokeOpacity: 0.018, fill: "#d9b36b", fillOpacity: 0.07 },
  },
};
