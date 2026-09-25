import { BHAVANO_LOGO_PNG_BASE64 } from './watermark-logo';
import { WORDMARK_BOX, WORDMARK_PATH } from './watermark-wordmark';

/** Share of the image width the centered "Bhavano" text spans. */
const TEXT_WIDTH_RATIO = 0.46;
const TEXT_OPACITY = 0.4;

/** Full-canvas transparent SVG carrying the Bhavano mark: a large centered wordmark plus the small
 * logo in the bottom-right corner. Everything scales off the actual output size, so the mark reads
 * the same on the 480px preview, the 1600px full photo and a 1280px video frame. Shared by the
 * photo worker (composited with sharp) and the video worker (rendered to a PNG and overlaid by
 * ffmpeg). The text is a vector path rather than <text>, because the server has no fonts — see
 * watermark-wordmark.ts. */
export function buildWatermarkSvg(width: number, height: number): Buffer {
  const { x1, y1, x2, y2 } = WORDMARK_BOX;
  const scale = (width * TEXT_WIDTH_RATIO) / (x2 - x1);
  const textHeight = (y2 - y1) * scale;
  const tx = (width - (x2 - x1) * scale) / 2 - x1 * scale;
  const ty = (height - textHeight) / 2 - y1 * scale;
  // Stroke is set in path units, so divide the wanted pixel width by the scale.
  const strokeWidth = Math.max(1, width * 0.007) / scale;

  const margin = Math.round(width * 0.03);
  const logoSize = Math.round(width * 0.11);
  const logoX = width - margin - logoSize;
  const logoY = height - margin - logoSize;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g opacity="${TEXT_OPACITY}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)})">
      <path d="${WORDMARK_PATH}" fill="#000000" stroke="#000000" stroke-width="${strokeWidth.toFixed(2)}" stroke-linejoin="round"/>
      <path d="${WORDMARK_PATH}" fill="#ffffff"/>
    </g>
    <image opacity="0.82" href="data:image/png;base64,${BHAVANO_LOGO_PNG_BASE64}"
           x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" />
  </svg>`;

  return Buffer.from(svg);
}
