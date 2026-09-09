import sharp from 'sharp';

/** 64-bit difference-hash (dHash): resize to 9x8 grayscale and compare adjacent pixels
 * per row. Cheap, dependency-light perceptual hash — good enough to catch identical or
 * lightly-recompressed duplicate photo submissions via Hamming-distance comparison.
 *
 * Its own file (not inlined in uploads.controller.ts, where it originated) so
 * ListingsService.addPhoto can reuse it without depending on a controller. */
export async function computeDHash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = '';
  for (let row = 0; row < info.height; row++) {
    for (let col = 0; col < info.width - 1; col++) {
      const left = data[row * info.width + col];
      const right = data[row * info.width + col + 1];
      bits += left < right ? '1' : '0';
    }
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}
