import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Site-wide default — used by every page that doesn't set its own `openGraph.images`/
// `twitter.images` (listing detail pages override with the listing's own photo; see
// `[city]/[[...rest]]/page.tsx`). Generated from theme colors rather than a static design file,
// since no branded 1200x630 asset existed — see docs/plans/og-share-image.md.
export const alt = "Bhavano — Buy, Rent, Plots, Coworking, PG & More";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const iconBuffer = await readFile(join(process.cwd(), "src/app/icon.png"));
  const iconDataUrl = `data:image/png;base64,${iconBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b3d2e",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- satori (ImageResponse) renders its own <img>, not next/image */}
          <img src={iconDataUrl} width={140} height={140} style={{ borderRadius: 28 }} alt="" />
          <span style={{ fontSize: 96, fontWeight: 700, color: "#efe9dc" }}>Bhavano</span>
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 34, color: "#d9b36b", textAlign: "center" }}>
          Buy · Rent · Villas · Plots · Coworking · PG · Commercial
        </div>
      </div>
    ),
    { ...size },
  );
}
