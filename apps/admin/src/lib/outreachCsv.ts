import type { City, CreateOutreachContactInput } from "@bhavano/types";

/** Parses CSV text into rows of cells. Handles quoted cells, "" escapes, commas and line breaks
 * inside quotes, CRLF, and a leading BOM (Excel's "CSV UTF-8" adds one). Blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Last 10 digits of an Indian number ("+91 98200 12345", "09820012345", "98200-12345"), else null. */
export function nationalNumber(raw: string | undefined): string | null {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}

/** "mobile" | "landline" | null. Decided on the RAW text: a leading 0 is an STD code, so
 * "080 2345 6789" is a Bengaluru landline even though, once the 0 is dropped, it reads like a
 * mobile. Anything starting 80 is also treated as a landline unless written 5+5, as mobiles are.
 * Mirrors get_agent_leads_from_portals_apify.py's phone_kind(); wrongly skipping a mobile costs
 * nothing, wrongly texting a landline is a failed, billed send. */
export function phoneKind(raw: string | undefined): "mobile" | "landline" | null {
  const number = nationalNumber(raw);
  if (!number) return null;
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) return "landline";
  if (!"6789".includes(number[0])) return "landline";
  if (number.startsWith("80") && !/\d{5}[\s-]?\d{5}\s*$/.test(raw ?? "")) return "landline";
  return "mobile";
}

const CITY_ALIASES: Record<string, string> = { bangalore: "bengaluru", gurgaon: "gurugram" };

export function findCityId(cities: City[], name: string | undefined): string | undefined {
  const key = (name ?? "").trim().toLowerCase();
  if (!key) return undefined;
  const wanted = CITY_ALIASES[key] ?? key;
  return cities.find((c) => c.name.trim().toLowerCase() === wanted)?.id;
}

export interface CsvImportRow {
  /** Position in the file, for stable keys. */
  index: number;
  contact: CreateOutreachContactInput;
  kind: "mobile" | "landline" | null;
  cityMatched: boolean;
  /** Pilot-CSV columns when present, shown so the reviewer can judge the match. */
  matchStatus?: string;
  matchScore?: string;
  portalName?: string;
  /** Selected by default: the pilot CSV's own "confident + mobile" verdict, or any mobile when the
   * file isn't a pilot CSV. Never a landline, never a row with no usable number. */
  defaultSelected: boolean;
}

export interface CsvImportOptions {
  cities: City[];
  tags: string[];
  businessCategory: string;
  sourceRef: string;
}

/** Maps a CSV with a header row to import candidates. Understands the agent-finder's results CSV
 * (firm, gmaps_name, phone, mobile, status, score, city, website, gmaps_address, gmaps_place_id,
 * portals, listings, portal_urls) and a plain contact sheet (name, phone, email, address, city,
 * website). Returns an error string when the header has no name or phone column. */
export function mapCsvRows(
  records: string[][],
  options: CsvImportOptions,
): { rows: CsvImportRow[] } | { error: string } {
  if (records.length < 2) return { error: "The file has no data rows." };
  const header = records[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;

  const nameCol = col("gmaps_name", "name", "firm");
  const firmCol = col("firm");
  const phoneCol = col("phone", "mobile_number", "phone_number");
  if (nameCol < 0 || phoneCol < 0) {
    return { error: 'The header needs a name column ("name", "gmaps_name" or "firm") and a "phone" column.' };
  }
  const get = (record: string[], i: number) => (i >= 0 ? (record[i] ?? "").trim() : "");
  const emailCol = col("email");
  const addressCol = col("gmaps_address", "address");
  const cityCol = col("city");
  const websiteCol = col("website");
  const placeIdCol = col("gmaps_place_id", "google_place_id");
  const statusCol = col("status");
  const scoreCol = col("score");
  const mobileCol = col("mobile");
  const portalsCol = col("portals");
  const listingsCol = col("listings");
  const urlsCol = col("portal_urls");
  const isPilotCsv = statusCol >= 0 && mobileCol >= 0;

  const rows: CsvImportRow[] = [];
  records.slice(1).forEach((record, i) => {
    const name = get(record, nameCol) || get(record, firmCol);
    if (!name) return;
    const phoneRaw = get(record, phoneCol);
    const number = nationalNumber(phoneRaw);
    const kind = phoneKind(phoneRaw);
    const cityName = get(record, cityCol);
    const cityId = findCityId(options.cities, cityName);
    const portalName = firmCol >= 0 ? get(record, firmCol) : "";
    const noteParts = [
      portalName && portalName !== name ? `Portal name: ${portalName}` : "",
      get(record, portalsCol) ? `Advertises on ${get(record, portalsCol)}` : "",
      get(record, listingsCol) ? `${get(record, listingsCol)} listings seen` : "",
      get(record, scoreCol) ? `Match score ${get(record, scoreCol)}` : "",
      get(record, urlsCol) ? `Portal listings: ${get(record, urlsCol)}` : "",
      cityName && !cityId ? `City not matched: ${cityName}` : "",
    ].filter(Boolean);

    const contact: CreateOutreachContactInput = {
      name,
      phone: number ?? undefined,
      email: get(record, emailCol) || undefined,
      address: get(record, addressCol) || undefined,
      cityId,
      googlePlaceId: get(record, placeIdCol) || undefined,
      businessCategory: options.businessCategory || undefined,
      website: get(record, websiteCol) || undefined,
      source: "scrape",
      sourceRef: options.sourceRef,
      tags: options.tags.length > 0 ? options.tags : undefined,
      notes: noteParts.length > 0 ? noteParts.join("\n") : undefined,
      // Never marked as consented: these people have not opted in.
      consentState: "none",
    };

    const confident = !isPilotCsv || get(record, statusCol).toLowerCase() === "confident";
    const pilotMobile = !isPilotCsv || get(record, mobileCol).toLowerCase() === "yes";
    rows.push({
      index: i,
      contact,
      kind,
      cityMatched: !!cityId,
      matchStatus: isPilotCsv ? get(record, statusCol) : undefined,
      matchScore: scoreCol >= 0 ? get(record, scoreCol) : undefined,
      portalName: portalName || undefined,
      defaultSelected: kind === "mobile" && confident && pilotMobile,
    });
  });
  return { rows };
}
