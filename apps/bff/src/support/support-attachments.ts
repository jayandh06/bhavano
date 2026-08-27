import { randomBytes } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENTS_TOTAL_BYTES,
} from '@bhavano/types/support';

export interface ProcessedAttachment {
  filename: string;
  mimeType: string;
  bytes: number;
  buffer: Buffer;
}

/** Leading bytes that actually identify a format, independent of the filename and of the
 * client-supplied mimetype (both trivially forged). HEIC/HEIF are ISO-BMFF: the brand sits at
 * offset 4 after an `ftyp` box, so they're matched separately below. */
const MAGIC_SIGNATURES: { mime: string; bytes: number[] }[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  {
    mime: 'image/png',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
];

function sniff(buffer: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (sig.bytes.every((b, i) => buffer[i] === b)) return sig.mime;
  }
  // RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  // ISO-BMFF (....ftyp) covering HEIC/HEIF and their AVIF cousins.
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1', 'avif'].includes(brand))
      return 'image/heic';
  }
  return null;
}

/** Validates and normalises one uploaded file.
 *
 * The re-encode is the security step, not an optimisation: it strips EXIF (screenshots and
 * camera photos routinely carry GPS the sender never intended to share) and makes polyglot
 * files — a valid image that is also a valid archive or script — structurally impossible,
 * because the output is bytes sharp produced rather than bytes the uploader supplied. Anything
 * sharp can't decode is rejected instead of stored.
 */
async function processOne(
  file: Express.Multer.File,
): Promise<ProcessedAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new BadRequestException(`"${file.originalname}" is larger than 5 MB`);
  }
  if (sniff(file.buffer) === null) {
    throw new BadRequestException(
      `"${file.originalname}" is not a supported image`,
    );
  }

  let buffer: Buffer;
  try {
    buffer = await sharp(file.buffer)
      .rotate() // bake in EXIF orientation before that metadata is discarded
      .resize({
        width: 2000,
        height: 2000,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new BadRequestException(
      `"${file.originalname}" could not be read as an image`,
    );
  }

  const base =
    file.originalname
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 60) || 'attachment';
  return {
    filename: `${base}.webp`,
    mimeType: 'image/webp',
    bytes: buffer.length,
    buffer,
  };
}

export async function processAttachments(
  files: Express.Multer.File[],
): Promise<ProcessedAttachment[]> {
  if (files.length > MAX_ATTACHMENTS) {
    throw new BadRequestException(`At most ${MAX_ATTACHMENTS} attachments`);
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_ATTACHMENTS_TOTAL_BYTES) {
    throw new BadRequestException('Attachments total more than 10 MB');
  }
  const processed: ProcessedAttachment[] = [];
  for (const file of files) {
    processed.push(await processOne(file));
  }
  return processed;
}

/** R2 keys carry 16 random bytes that are never shown to anyone.
 *
 * The bucket is fronted by cdn.bhavano.com and objects under it are publicly readable, so a
 * predictable key would make this anonymous upload endpoint into public file hosting — and
 * `support/<ticketId>/1.webp` is entirely predictable to the uploader, who is handed their own
 * ticket id in the submission confirmation. The random segment means possessing the ticket id
 * is not enough to construct the URL.
 *
 * This is defence in depth, not the fix: the objects are still public to anyone holding the
 * full key. Blocking the `support/` prefix at the CDN is the actual remedy — see
 * docs/plans/contact-us-support-form.md. The stored r2Key is what the retention job and any
 * future retrieval use, so nothing depends on the key being derivable.
 */
export function attachmentKey(ticketId: string, index: number): string {
  return `support/${ticketId}-${randomBytes(16).toString('hex')}/${index + 1}.webp`;
}
