import sharp from 'sharp';
import { buildWatermarkSvg } from './watermark';

/** Renders the mark and returns the bounding box of everything painted outside the bottom-right
 * corner where the logo lives — i.e. just the centered wordmark. */
async function wordmarkBox(width: number, height: number) {
  const { data, info } = await sharp(buildWatermarkSvg(width, height))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const inLogoCorner = x > info.width * 0.8 && y > info.height * 0.7;
      if (inLogoCorner) continue;
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { minX, minY, maxX, maxY, width: info.width, height: info.height };
}

describe('buildWatermarkSvg', () => {
  it('draws the word as a path, never as <text> (the server has no fonts, so text renders as boxes)', () => {
    const svg = buildWatermarkSvg(800, 450).toString('utf8');
    expect(svg).not.toContain('<text');
    expect(svg).toContain('<path');
  });

  it.each([
    [480, 270],
    [1600, 1067],
    [720, 1280],
    [1280, 720],
  ])('centers the wordmark on a %ix%i image at roughly 46%% of its width', async (w, h) => {
    const box = await wordmarkBox(w, h);
    const boxCenterX = (box.minX + box.maxX) / 2;
    const boxCenterY = (box.minY + box.maxY) / 2;
    expect(Math.abs(boxCenterX - w / 2)).toBeLessThanOrEqual(3);
    expect(Math.abs(boxCenterY - h / 2)).toBeLessThanOrEqual(3);
    const spanRatio = (box.maxX - box.minX) / w;
    expect(spanRatio).toBeGreaterThan(0.44);
    expect(spanRatio).toBeLessThan(0.5);
  });

  it('keeps the logo in the bottom-right corner', async () => {
    const { data, info } = await sharp(buildWatermarkSvg(800, 450))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const cornerAlpha = data[((info.height - 30) * info.width + (info.width - 30)) * 4 + 3];
    const topLeftAlpha = data[(10 * info.width + 10) * 4 + 3];
    expect(cornerAlpha).toBeGreaterThan(0);
    expect(topLeftAlpha).toBe(0);
  });
});
