import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { computeDHash } from './photo-hash';

describe('computeDHash', () => {
  it('hashes a valid image to 16 hex characters', async () => {
    const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#888' } }).jpeg().toBuffer();
    await expect(computeDHash(jpeg)).resolves.toMatch(/^[0-9a-f]{16}$/);
  });

  it('turns a truncated JPEG into a 400, not a 500', async () => {
    const noise = Buffer.alloc(200 * 200 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919) % 251;
    const jpeg = await sharp(noise, { raw: { width: 200, height: 200, channels: 3 } }).jpeg().toBuffer();
    await expect(computeDHash(jpeg.subarray(0, Math.floor(jpeg.length / 3)))).rejects.toBeInstanceOf(BadRequestException);
  });
});
