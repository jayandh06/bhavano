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
export type CoverShape = {
    t: "rect";
    x: number;
    y: number;
    w: number;
    h: number;
    r?: number;
    fill: CoverTone;
    o?: number;
    stroke?: CoverTone;
    sw?: number;
} | {
    t: "circle";
    cx: number;
    cy: number;
    r: number;
    fill?: CoverTone;
    o?: number;
    stroke?: CoverTone;
    sw?: number;
} | {
    t: "ellipse";
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    fill: CoverTone;
    o?: number;
} | {
    t: "poly";
    pts: string;
    fill: CoverTone;
    o?: number;
} | {
    t: "path";
    d: string;
    fill?: CoverTone;
    stroke?: CoverTone;
    sw?: number;
    o?: number;
};
export type CoverPalette = Record<CoverTone, string>;
export declare const COVER_VIEWBOX = "0 0 200 105";
/** Width over height, for sizing a box that holds a cover. */
export declare const COVER_RATIO: number;
/** Brand-led colour sets. `bg` is the picture's own background, so a cover looks the same on a
 * light or a dark page. */
export declare const COVER_PALETTES: CoverPalette[];
export type CoverMotif = "flats" | "house" | "plot" | "approvals" | "calculator" | "key" | "map" | "skyline" | "crane" | "bed" | "desk" | "boxes" | "magnifier" | "chart" | "phone" | "people";
export interface CoverScene {
    motif: CoverMotif;
    /** What the picture shows, for the alt text. */
    alt: string;
    palette: CoverPalette;
    shapes: CoverShape[];
}
export declare function motifFor(slug: string): CoverMotif;
/** The drawn cover for an article: chosen by topic, coloured and detailed from its slug. */
export declare function coverFor(post: {
    slug: string;
}): CoverScene;
export declare const COVER_MOTIFS: CoverMotif[];
