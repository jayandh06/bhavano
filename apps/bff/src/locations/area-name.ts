import { BadRequestException } from '@nestjs/common';

const MAX_AREA_NAME_LENGTH = 60;

/** Cleans a free-text location before it becomes an `Area` row, and so a public URL and page title.
 * Free text used to go in untouched, which produced areas like
 * "Govardhan Chatta Road  Kunjera  PO Radhakund  Pin  281504" (a whole postal address) and
 * "kizharoor, ambalathinkala". An area is a locality, not an address, so this:
 *  - drops a pin code (and a "Pin" label before it),
 *  - collapses repeated whitespace,
 *  - refuses what is still too long to be a locality name.
 * A comma is kept: "Sector 30, Kharghar" is a real name, and cutting it would leave an ambiguous
 * "Sector 30". Casing is left alone too: proper nouns are not reliably recoverable from lowercase. */
export function cleanAreaName(raw: string): string {
  const cleaned = raw
    .replace(/\bpin\s*(code)?\s*[:\-]?\s*\d{6}\b/gi, ' ')
    .replace(/\b\d{6}\b/g, ' ')
    .replace(/\s*,\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    throw new BadRequestException('Either areaId or areaName is required');
  }
  if (cleaned.length > MAX_AREA_NAME_LENGTH) {
    throw new BadRequestException('Please enter just the locality name (for example "Koramangala"), not a full address');
  }
  return cleaned;
}
