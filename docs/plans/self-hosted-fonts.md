# Self-hosted Lora and Manrope

Built 2026-11-26.

## Why

`next/font/google` downloads the font files from Google while building. That download failed repeatedly (image builds, and the
CI web server returning 500 at startup), blocking merges and deploys for reasons unrelated to the change.

## What

- `apps/web/src/app/fonts/` holds 20 `.woff2` files, copied from what `next/font/google` itself had produced (Lora 500-700
  normal and italic, Manrope 400-800), the OFL licence, and `index.ts`.
- `index.ts` makes one `next/font/local` font per script subset, each with Google's `unicode-range`, so a browser still
  fetches only the subsets a page uses. **The rupee sign is in `latin-ext`**, so do not drop that subset.
- Only the three Latin files are preloaded, as before.
- `globals.css` joins the subsets into `--font-lora` and `--font-manrope`, followed by the same size-adjusted fallback faces
  (`Lora Fallback` on Times New Roman, `Manrope Fallback` on Arial) that Next generated, so layout shift is unchanged.
- Nothing else changed: components still use `font-lora` / `font-manrope`.

## Checked

- Text width and height for 96 combinations (family, weight 300-800, normal and italic; Latin, rupee, Cyrillic, Greek,
  Vietnamese and math samples) were identical before and after on a local dev server.
- A production build with the US settings (`/us` base path) succeeds with no request or reference to Google Fonts and
  relative font URLs.

## Caveats

- Font updates from Google are no longer picked up automatically. To add a weight or script, replace the files and update
  `index.ts` and `globals.css` together.
- The fallback metrics are fixed numbers in `globals.css`; recompute them if the fonts are replaced.
