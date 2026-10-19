import { BadRequestException } from '@nestjs/common';

const MAX_AREA_NAME_LENGTH = 60;

/** Cleans a free-text location before it becomes an `Area` row, and so a public URL and page title.
 * Free text used to go in untouched, which produced areas like
 * "Govardhan Chatta Road  Kunjera  PO Radhakund  Pin  281504" (a whole postal address) and
 * "kizharoor, ambalathinkala". An area is a locality, not an address, so this:
 *  - drops a pin code (and a "Pin" label before it),
 *  - collapses repeated whitespace,
 *  - refuses what is still too long to be a locality name.
 *  - rejects a web link (a pasted map URL) and directions ("Near ...", "Opposite ..."), which are
 *    not a locality,
 *  - capitalises a name typed entirely in lowercase ("kurasi road" becomes "Kurasi Road"), so the
 *    page title and URL read properly; anything that already has a capital is left as typed.
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
  if (/https?:\/\/|www\.|goo\.gl|maps\./i.test(cleaned)) {
    throw new BadRequestException('Please enter the locality name, not a link');
  }
  if (/^(near|opp|opposite|behind|beside)\b/i.test(cleaned)) {
    throw new BadRequestException('Please enter the locality name (for example "Koramangala"), not directions to it');
  }
  if (cleaned.length > MAX_AREA_NAME_LENGTH) {
    throw new BadRequestException('Please enter just the locality name (for example "Koramangala"), not a full address');
  }
  return /[A-Z]/.test(cleaned) ? cleaned : capitalise(cleaned);
}

/** "kurasi road" -> "Kurasi Road". Only the first letter of each word, so "raju's" -> "Raju's". */
function capitalise(text: string): string {
  return text.replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => `${space}${letter.toUpperCase()}`);
}
