// Twitter/X's crawler falls back to Open Graph tags when `twitter:image` is absent, but the
// Sitechecker audit flagged the Twitter Card as "incomplete" without an explicit one — so this
// file exists purely so Next.js emits both, sharing the same generated image.
export { default, alt, size, contentType } from "./opengraph-image";
