import { readFileSync } from "fs";
import { join } from "path";
import { TRELLIS_DOTS, TRELLIS_PAINT, TRELLIS_PATH, TRELLIS_SIZE, TRELLIS_STROKE_WIDTH, type TrellisSurface } from "./trellis";

/** The app draws the website's tile from its own numbers, so a change to one has to reach the other. */

const css = readFileSync(join(__dirname, "../../../web/src/app/globals.css"), "utf8");

/** The tile the website declares for a surface: the first declaration is light mode's, the second dark mode's. */
function webTile(surface: TrellisSurface, theme: "light" | "dark"): string {
  const found = [...css.matchAll(new RegExp(`--trellis-${surface}: url\\("data:image/svg\\+xml,(.*)"\\);`, "g"))];
  expect(found).toHaveLength(2);
  return found[theme === "light" ? 0 : 1][1].replace(/%23/g, "#");
}

describe("the app's trellis background", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const surface of ["band", "head", "body"] as const) {
      it(`matches the website's ${theme} ${surface} tile`, () => {
        const tile = webTile(surface, theme);
        const paint = TRELLIS_PAINT[theme][surface];
        expect(tile).toContain(`width='${TRELLIS_SIZE}' height='${TRELLIS_SIZE}'`);
        expect(tile).toContain(`d='${TRELLIS_PATH}'`);
        // The website writes 0.2 as ".2".
        const css3 = (n: number) => String(n).replace(/^0\./, ".");
        expect(tile).toContain(
          `stroke='${paint.stroke}' stroke-width='${css3(TRELLIS_STROKE_WIDTH)}' stroke-opacity='${css3(paint.strokeOpacity)}'`,
        );
        expect(tile).toContain(`<g fill='${paint.fill}' fill-opacity='${css3(paint.fillOpacity)}'>`);
        const dots = [...tile.matchAll(/<circle cx='([\d.]+)' cy='([\d.]+)' r='([\d.]+)'\/>/g)].map((m) => m.slice(1).map(Number));
        expect(dots).toEqual(TRELLIS_DOTS.map((dot) => [...dot]));
      });
    }
  }
});
