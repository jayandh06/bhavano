/** Drawn cover pictures for blog articles: simple flat scenes made of rectangles, circles, polygons
 * and paths on a 200 x 105 canvas. One description of each scene is shared by the website (inline
 * SVG) and the app (react-native-svg), so both draw the same picture and there are no image files
 * to host or load.
 *
 * Rules: no text in any picture (there is no text shape), no people's faces, no real buildings or
 * logos, nothing that could pass for a listing photo. Each article gets one scene chosen by its
 * topic, in one of five colour sets and with details (which windows are lit, where the sun sits)
 * varied from its slug, so neighbouring articles do not look identical.
 *
 * An article can also carry a real photograph (`cover` on the post); this is the fallback for every
 * article without one. See docs/plans/blog-covers.md. */

export type CoverTone = "bg" | "ink" | "deep" | "mid" | "pale" | "accent" | "accentPale" | "white";

export type CoverShape =
  | { t: "rect"; x: number; y: number; w: number; h: number; r?: number; fill: CoverTone; o?: number; stroke?: CoverTone; sw?: number }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: CoverTone; o?: number; stroke?: CoverTone; sw?: number }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill: CoverTone; o?: number }
  | { t: "poly"; pts: string; fill: CoverTone; o?: number }
  | { t: "path"; d: string; fill?: CoverTone; stroke?: CoverTone; sw?: number; o?: number };

export type CoverPalette = Record<CoverTone, string>;

export const COVER_VIEWBOX = "0 0 200 105";
/** Width over height, for sizing a box that holds a cover. */
export const COVER_RATIO = 200 / 105;

/** Brand-led colour sets. `bg` is the picture's own background, so a cover looks the same on a
 * light or a dark page. */
export const COVER_PALETTES: CoverPalette[] = [
  { bg: "#F1EBDC", ink: "#1C1C1A", deep: "#0B3D2E", mid: "#1F6B52", pale: "#CFE3D6", accent: "#C9A15A", accentPale: "#E8D3A6", white: "#FFFFFF" },
  { bg: "#E6EFE9", ink: "#1C1C1A", deep: "#0B3D2E", mid: "#2D7A5F", pale: "#BFD9CB", accent: "#D9B26A", accentPale: "#F0DDB0", white: "#FFFFFF" },
  { bg: "#ECE8DF", ink: "#1C1C1A", deep: "#1F2A30", mid: "#3E5560", pale: "#C9D6DB", accent: "#C9A15A", accentPale: "#E8D3A6", white: "#FFFFFF" },
  { bg: "#F5E6DC", ink: "#1C1C1A", deep: "#5A2A1E", mid: "#A8553C", pale: "#EBC9B8", accent: "#C9A15A", accentPale: "#E8D3A6", white: "#FFFFFF" },
  { bg: "#E3EFEF", ink: "#1C1C1A", deep: "#0F3B3F", mid: "#2C7A7B", pale: "#B7D8D8", accent: "#E0A84F", accentPale: "#F2D9A0", white: "#FFFFFF" },
];

export type CoverMotif =
  | "flats"
  | "house"
  | "plot"
  | "approvals"
  | "calculator"
  | "key"
  | "map"
  | "skyline"
  | "crane"
  | "bed"
  | "desk"
  | "boxes"
  | "magnifier"
  | "chart"
  | "phone"
  | "people";

export interface CoverScene {
  motif: CoverMotif;
  /** What the picture shows, for the alt text. */
  alt: string;
  palette: CoverPalette;
  shapes: CoverShape[];
}

const ALT: Record<CoverMotif, string> = {
  flats: "Illustration of a block of flats with lit windows, a tree and the sun",
  house: "Illustration of a house with a door, two windows and a tree",
  plot: "Illustration of a fenced plot of land with a sign post and a small house",
  approvals: "Illustration of an official document with a shield and a tick",
  calculator: "Illustration of a calculator beside a stack of coins",
  key: "Illustration of a key and a house-shaped tag",
  map: "Illustration of a map with a route and a location pin",
  skyline: "Illustration of a city skyline of tall buildings",
  crane: "Illustration of a crane beside a building under construction",
  bed: "Illustration of a bed, a bedside lamp and a window",
  desk: "Illustration of a desk with a monitor, a plant and a mug",
  boxes: "Illustration of stacked storage boxes",
  magnifier: "Illustration of a magnifying glass over a house and a document",
  chart: "Illustration of a rising bar chart with a trend line",
  phone: "Illustration of a phone showing a property listing",
  people: "Illustration of two people with a document between them",
};

/* ---- seeded variation ------------------------------------------------------------------- */

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- tiny shape helpers ----------------------------------------------------------------- */

const R = (x: number, y: number, w: number, h: number, fill: CoverTone, r?: number, o?: number): CoverShape => ({ t: "rect", x, y, w, h, fill, ...(r ? { r } : {}), ...(o ? { o } : {}) });
const C = (cx: number, cy: number, r: number, fill: CoverTone, o?: number): CoverShape => ({ t: "circle", cx, cy, r, fill, ...(o ? { o } : {}) });
const E = (cx: number, cy: number, rx: number, ry: number, fill: CoverTone, o?: number): CoverShape => ({ t: "ellipse", cx, cy, rx, ry, fill, ...(o ? { o } : {}) });
const P = (pts: string, fill: CoverTone, o?: number): CoverShape => ({ t: "poly", pts, fill, ...(o ? { o } : {}) });
const Line = (d: string, stroke: CoverTone, sw: number): CoverShape => ({ t: "path", d, stroke, sw });
const Ring = (cx: number, cy: number, r: number, stroke: CoverTone, sw: number, fill?: CoverTone, o?: number): CoverShape => ({ t: "circle", cx, cy, r, stroke, sw, ...(fill ? { fill } : {}), ...(o ? { o } : {}) });

/** A grid of small windows, each lit or dark by chance. */
function windows(out: CoverShape[], rng: () => number, x: number, y: number, w: number, h: number, cols: number, rows: number): void {
  const cw = w / cols;
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push(R(x + c * cw + (cw - 5) / 2, y + r * rh + (rh - 6) / 2, 5, 6, rng() < 0.32 ? "accent" : "bg"));
    }
  }
}

const sky = (rng: () => number): CoverShape[] => [R(0, 0, 200, 105, "bg"), C(150 + rng() * 26, 16 + rng() * 6, 8 + rng() * 3, "accent")];
const ground = (y = 92): CoverShape[] => [R(0, y, 200, 105 - y, "pale")];

/* ---- the scenes ------------------------------------------------------------------------- */

const SCENES: Record<CoverMotif, (rng: () => number) => CoverShape[]> = {
  flats(rng) {
    const s = [...sky(rng), ...ground()];
    s.push(R(60, 26, 40, 66, "mid"), R(22, 44, 38, 48, "deep"), R(104, 36, 34, 56, "deep"), R(138, 54, 30, 38, "mid"));
    windows(s, rng, 66, 32, 28, 50, 3, 5);
    windows(s, rng, 27, 50, 28, 34, 3, 4);
    windows(s, rng, 109, 42, 24, 40, 2, 4);
    windows(s, rng, 143, 60, 20, 24, 2, 3);
    s.push(R(74, 82, 10, 10, "accent"), C(12, 84, 7, "mid"), R(11, 88, 2, 4, "deep"));
    return s;
  },
  house(rng) {
    const s = [...sky(rng), ...ground()];
    s.push(R(121, 26, 9, 18, "mid"), R(60, 50, 80, 42, "deep"), P("52,52 100,22 148,52", "mid"));
    s.push(R(93, 66, 14, 26, "accent"), R(68, 60, 16, 14, "bg"), R(116, 60, 16, 14, "bg"));
    s.push(R(75.5, 60, 1.5, 14, "pale"), R(123.5, 60, 1.5, 14, "pale"));
    s.push(C(26, 78, 12, "mid"), R(24.5, 84, 3, 8, "deep"), C(176, 82, 8, "mid"), R(174.5, 86, 3, 6, "deep"));
    return s;
  },
  plot(rng) {
    const s = [...sky(rng), R(0, 62, 200, 43, "pale")];
    s.push(P("20,100 44,66 160,66 184,100", "accentPale", 0.8), Line("M44 66 L20 100 M160 66 L184 100", "accent", 1.5));
    for (let i = 0; i < 10; i++) s.push(R(30 + i * 15, 62, 3, 20, "deep"));
    s.push(R(24, 67, 150, 2.5, "deep"), R(24, 75, 150, 2.5, "deep"));
    s.push(R(98, 28, 3, 36, "deep"), R(80, 18, 40, 18, "accent", 3), R(86, 24, 28, 3, "white"), R(86, 29, 18, 3, "white"));
    s.push(R(146, 48, 26, 16, "mid"), P("142,50 159,36 176,50", "deep"), R(156, 54, 6, 10, "accent"));
    return s;
  },
  approvals(rng) {
    const s: CoverShape[] = [R(0, 0, 200, 105, "bg"), C(24 + rng() * 10, 20, 6, "accentPale"), C(176 - rng() * 10, 84, 9, "pale")];
    s.push({ t: "rect", x: 50, y: 10, w: 66, h: 86, r: 4, fill: "white", stroke: "pale", sw: 1 });
    s.push(P("98,10 116,28 98,28", "pale"), R(60, 22, 28, 6, "deep"), R(60, 38, 48, 4, "pale"), R(60, 48, 40, 4, "pale"), R(60, 58, 48, 4, "pale"), R(60, 68, 30, 4, "pale"));
    s.push(P("136,50 164,62 164,84 150,98 136,102 122,98 108,84 108,62", "deep"));
    s.push(Line("M124 82 L133 91 L150 72", "accent", 5));
    return s;
  },
  calculator(rng) {
    const s: CoverShape[] = [R(0, 0, 200, 105, "bg"), C(22 + rng() * 10, 20, 7, "accentPale"), C(172, 24, 5, "pale")];
    s.push(R(66, 6, 72, 92, "deep", 9), R(74, 14, 56, 20, "pale", 4), R(100, 20, 24, 8, "deep"));
    for (const x of [74, 94, 114]) for (const y of [42, 56, 70]) if (!(x === 114 && y === 70)) s.push(R(x, y, 16, 10, "mid", 3));
    s.push(R(114, 70, 16, 22, "accent", 3), R(74, 84, 36, 8, "mid", 3));
    // A stack of three coins, bottom one first so each sits on the last.
    for (let i = 0; i < 3; i++) {
      const y = 86 - i * 8;
      s.push(R(20, y - 8, 36, 8, "accent"), E(38, y, 18, 5, "accent"), E(38, y - 8, 18, 5, "accentPale"));
    }
    return s;
  },
  key(rng) {
    const s: CoverShape[] = [R(0, 0, 200, 105, "bg"), C(30 + rng() * 12, 80, 8, "pale"), C(170, 22, 6, "accentPale")];
    s.push(C(60, 48, 24, "accent"), C(60, 48, 11, "bg"), R(82, 44, 78, 9, "accent"), R(132, 53, 9, 14, "accent"), R(148, 53, 9, 10, "accent"));
    s.push(R(96, 66, 50, 28, "white", 5), P("100,80 121,62 142,80", "mid"), R(108, 80, 26, 14, "deep"), R(117, 84, 8, 10, "accent"));
    s.push(Ring(146, 62, 3, "deep", 1.5));
    return s;
  },
  map(rng) {
    const s: CoverShape[] = [R(0, 0, 200, 105, "bg"), R(20, 8, 160, 90, "pale", 6)];
    s.push(R(20, 50, 160, 9, "white"), R(84, 8, 9, 90, "white"), R(132, 8, 7, 90, "white"), R(20, 24, 64, 5, "white"), R(139, 76, 41, 5, "white"));
    s.push(R(28, 14, 48, 8, "mid", 2, 0.55), R(28, 64, 50, 24, "mid", 3, 0.55), R(98, 64, 30, 28, "mid", 3, 0.55), R(98, 14, 28, 30, "accentPale", 3), C(158 + rng() * 6, 38, 11, "accentPale"));
    s.push(Line("M34 88 L88 54 L135 54 L135 36", "accent", 3.2));
    s.push(C(135, 28, 10, "deep"), C(135, 28, 4, "bg"), P("127,34 143,34 135,50", "deep"));
    return s;
  },
  skyline(rng) {
    const s = [...sky(rng), ...ground(90)];
    let x = 16;
    let i = 0;
    while (x < 180) {
      const w = 14 + Math.floor(rng() * 12);
      const h = 28 + Math.floor(rng() * 44);
      if (x + w > 184) break;
      s.push(R(x, 90 - h, w, h, i % 2 ? "mid" : "deep"));
      if (rng() < 0.4) s.push(R(x + w / 2 - 1, 90 - h - 8, 2, 8, "deep"));
      windows(s, rng, x + 2, 90 - h + 4, w - 4, h - 12, Math.max(2, Math.floor(w / 7)), Math.max(2, Math.floor(h / 12)));
      x += w + 3;
      i++;
    }
    return s;
  },
  crane(rng) {
    const s = [...sky(rng), ...ground()];
    s.push(R(100, 56, 56, 36, "mid"), R(106, 62, 12, 10, "bg"), R(124, 62, 12, 10, "bg"), R(106, 78, 12, 10, "bg"), R(124, 78, 12, 10, "bg"));
    for (const x of [100, 116, 132, 150]) s.push(R(x, 36, 3, 20, "deep"));
    s.push(R(100, 36, 53, 3, "deep"), R(100, 46, 53, 3, "deep"));
    s.push(R(58, 14, 6, 78, "accent"), R(34, 12, 96, 5, "accent"), R(34, 17, 12, 9, "deep"), P("58,8 64,8 61,2", "accent"));
    s.push(R(112, 17, 1.6, 22, "deep"), R(104, 39, 18, 7, "mid"));
    for (let y = 22; y < 90; y += 12) s.push(P(`58,${y} 64,${y + 6} 58,${y + 12}`, "deep", 0.35));
    return s;
  },
  bed(rng) {
    const s: CoverShape[] = [R(0, 0, 200, 105, "bg"), R(0, 90, 200, 15, "pale"), C(24 + rng() * 6, 26, 6, "accentPale")];
    s.push(R(74, 12, 46, 30, "pale", 3), R(95, 12, 3, 30, "white"), R(74, 25, 46, 3, "white"));
    s.push(R(36, 34, 8, 54, "deep"), R(40, 58, 122, 26, "deep"), R(44, 50, 114, 12, "white"), R(50, 43, 30, 10, "accentPale", 4), R(86, 48, 70, 14, "mid"));
    s.push(R(44, 84, 5, 8, "deep"), R(152, 84, 5, 8, "deep"));
    s.push(R(166, 66, 20, 24, "mid"), P("169,58 183,58 179,44 173,44", "accent"), R(175.5, 58, 2, 8, "deep"));
    return s;
  },
  desk(rng) {
    const s: CoverShape[] = [R(0, 0, 200, 105, "bg"), R(0, 90, 200, 15, "pale"), C(160 + rng() * 14, 20, 8, "accentPale")];
    s.push(R(36, 66, 128, 6, "deep"), R(42, 72, 5, 20, "deep"), R(153, 72, 5, 20, "deep"));
    s.push(R(74, 30, 52, 32, "deep", 3), R(79, 35, 42, 22, "pale"), R(84, 40, 22, 3, "mid"), R(84, 46, 30, 3, "mid"), R(84, 51, 16, 3, "accent"), R(97, 62, 6, 4, "deep"));
    s.push(R(136, 52, 12, 14, "accent"), C(142, 44, 8, "mid"), C(136, 49, 5, "mid"), C(148, 49, 5, "mid"));
    s.push(R(48, 58, 10, 8, "white", 2), Ring(60, 62, 2.6, "white", 1.5));
    return s;
  },
  boxes(rng) {
    const s: CoverShape[] = [R(0, 0, 200, 105, "bg"), R(0, 90, 200, 15, "pale"), C(24 + rng() * 10, 22, 6, "accentPale")];
    const box = (x: number, y: number, w: number, h: number, fill: CoverTone) => {
      s.push(R(x, y, w, h, fill), R(x + w / 2 - 3, y, 6, h * 0.42, "deep", 0, 0.3), R(x, y + h - 3, w, 3, "deep", 0, 0.12));
    };
    box(30, 66, 40, 26, "accent");
    box(74, 66, 40, 26, "accentPale");
    box(118, 66, 40, 26, "accent");
    box(52, 42, 40, 24, "mid");
    box(96, 42, 40, 24, "accent");
    box(74, 18, 40, 24, "accentPale");
    s.push(R(168, 40, 4, 52, "deep"), R(162, 52, 16, 3, "deep"), R(162, 70, 16, 3, "deep"));
    return s;
  },
  magnifier(rng) {
    const s: CoverShape[] = [R(0, 0, 200, 105, "bg"), C(24 + rng() * 8, 80, 8, "pale"), C(172, 20, 6, "accentPale")];
    s.push({ t: "rect", x: 38, y: 16, w: 50, h: 70, r: 4, fill: "white", stroke: "pale", sw: 1 });
    s.push(R(46, 26, 26, 5, "deep"), R(46, 38, 34, 4, "pale"), R(46, 47, 28, 4, "pale"), R(46, 56, 34, 4, "pale"));
    s.push(R(78, 48, 38, 30, "deep"), P("72,50 97,28 122,50", "mid"), R(92, 62, 10, 16, "accent"));
    s.push(Ring(128, 50, 25, "accent", 6, "white", 0.4), Line("M146 68 L170 92", "accent", 8));
    return s;
  },
  chart(rng) {
    const s: CoverShape[] = [R(0, 0, 200, 105, "bg"), C(24 + rng() * 8, 22, 6, "accentPale")];
    s.push(R(28, 14, 3, 76, "deep"), R(28, 87, 148, 3, "deep"));
    const heights = [16, 26, 22, 38, 52];
    heights.forEach((h, i) => s.push(R(40 + i * 28, 87 - h, 18, h, i === 4 ? "accent" : i % 2 ? "mid" : "deep")));
    s.push(Line("M49 66 L77 56 L105 60 L133 40 L161 22", "deep", 3), C(161, 22, 6, "accent"), P("172,18 160,14 163,28", "deep"));
    return s;
  },
  phone(rng) {
    const s: CoverShape[] = [R(0, 0, 200, 105, "bg"), C(40, 36 + rng() * 6, 11, "accent", 0.9), C(160, 62, 14, "mid", 0.9)];
    s.push(R(74, 4, 52, 98, "deep", 9), R(79, 14, 42, 78, "bg", 4), R(83, 20, 34, 26, "pale", 3));
    s.push(R(88, 34, 24, 12, "mid"), P("85,36 100,26 115,36", "deep"), R(97, 38, 6, 8, "accent"));
    s.push(R(83, 52, 34, 6, "pale", 2), R(83, 62, 24, 6, "pale", 2), R(83, 74, 34, 11, "accent", 4), R(96, 95, 8, 2, "bg", 1));
    s.push(Line("M34 36 L39 41 L47 31", "white", 2.4), Line("M153 62 L158 67 L167 56", "white", 2.4));
    return s;
  },
  people(rng) {
    const s: CoverShape[] = [R(0, 0, 200, 105, "bg"), R(0, 90, 200, 15, "pale"), C(24 + rng() * 10, 22, 6, "accentPale"), C(170, 24, 5, "pale")];
    s.push(C(66, 34, 11, "mid"), R(52, 48, 28, 40, "deep", 12), R(56, 86, 8, 10, "deep"), R(68, 86, 8, 10, "deep"));
    s.push(C(134, 34, 11, "accent"), R(120, 48, 28, 40, "mid", 12), R(124, 86, 8, 10, "mid"), R(136, 86, 8, 10, "mid"));
    s.push({ t: "rect", x: 88, y: 56, w: 24, h: 30, r: 3, fill: "white", stroke: "pale", sw: 1 }, R(93, 62, 14, 3, "deep"), R(93, 69, 14, 3, "pale"), R(93, 76, 10, 3, "pale"));
    return s;
  },
};

/* ---- which scene for which article ------------------------------------------------------ */

const MOTIF_BY_SLUG: Record<string, CoverMotif> = {
  "pg-hunting-checklist": "bed",
  "womens-pg-checklist": "bed",
  "coworking-or-small-office": "desk",
  "rental-agreement-questions": "approvals",
  "spotting-a-bad-property-ad": "magnifier",
  "carpet-built-up-super-built-up-area": "house",
  "rent-or-buy-questions": "key",
  "home-loan-emi-explained": "calculator",
  "flat-viewing-checklist": "flats",
  "write-a-property-listing-that-gets-enquiries": "phone",
  "buying-a-plot-checklist": "plot",
  "real-estate-investment-basics": "chart",
  "ready-to-move-vs-under-construction": "crane",
  "how-to-sell-your-house-or-flat-online": "phone",
  "how-to-find-reliable-tenants": "people",
  "commercial-space-for-rent-what-to-check": "desk",
  "villa-or-apartment-which-to-choose": "house",
  "storage-space-for-rent": "boxes",
  "property-approvals-documents-checklist": "approvals",
  "rera-explained-for-home-buyers": "approvals",
  "dtcp-approved-plots-explained": "plot",
  "bda-approved-sites-bengaluru": "map",
  "occupancy-certificate-and-completion-certificate": "approvals",
  "a-khata-b-khata-bengaluru": "approvals",
  "construction-stage-to-buy-from-builder": "crane",
  "how-to-sell-property-online-in-india": "phone",
  "what-does-bhk-mean": "flats",
  "real-estate-terms-explained-india": "magnifier",
  "security-deposit-for-rent-in-india": "key",
  "verify-property-owner-before-paying-token": "people",
  "freehold-vs-leasehold-property-india": "plot",
  "society-maintenance-charges-explained": "flats",
  "down-payment-for-a-home-loan": "calculator",
  "how-to-check-property-title-is-clear": "magnifier",
  "how-to-calculate-rental-yield": "chart",
  "stamp-duty-and-registration-charges-explained": "calculator",
  "capital-gains-tax-on-property-explained": "chart",
};

/** For an article that has no entry above (a new one): a sensible scene from words in its slug. */
const MOTIF_RULES: [RegExp, CoverMotif][] = [
  [/builders?-in-/, "skyline"],
  [/pg|hostel/, "bed"],
  [/cowork|office|commercial/, "desk"],
  [/storage|moving/, "boxes"],
  [/plot|layout|land|dtcp/, "plot"],
  [/rera|khata|approval|certificate|agreement|document|title|legal/, "approvals"],
  [/emi|loan|down-payment|stamp|tax|deposit/, "calculator"],
  [/invest|yield|price|value/, "chart"],
  [/sell|listing|online|photo/, "phone"],
  [/tenant|owner|broker|agent|people/, "people"],
  [/crane|construction|builder|under-construction|ready/, "crane"],
  [/map|area|locality|location|neighbourhood/, "map"],
  [/spot|check|verify|scam|fraud|search/, "magnifier"],
  [/key|buy|rent/, "key"],
  [/villa|house|home/, "house"],
];

export function motifFor(slug: string): CoverMotif {
  const direct = MOTIF_BY_SLUG[slug];
  if (direct) return direct;
  for (const [pattern, motif] of MOTIF_RULES) if (pattern.test(slug)) return motif;
  return "flats";
}

/** The drawn cover for an article: chosen by topic, coloured and detailed from its slug. */
export function coverFor(post: { slug: string }): CoverScene {
  const seed = hash(post.slug);
  const motif = motifFor(post.slug);
  return {
    motif,
    alt: ALT[motif],
    palette: COVER_PALETTES[seed % COVER_PALETTES.length],
    shapes: SCENES[motif](rngFrom(seed)),
  };
}

export const COVER_MOTIFS = Object.keys(SCENES) as CoverMotif[];
