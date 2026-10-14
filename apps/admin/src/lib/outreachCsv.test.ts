import { describe, expect, it } from "vitest";
import type { City } from "@bhavano/types";
import { findCityId, mapCsvRows, nationalNumber, parseCsv, phoneKind } from "./outreachCsv";

const cities = [
  { id: "c-blr", name: "Bengaluru" },
  { id: "c-che", name: "Chennai" },
] as City[];

const options = { cities, tags: ["portal-agent"], businessCategory: "real_estate_agent", sourceRef: "csv:test.csv" };

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines inside cells", () => {
    const rows = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n"line1\nline2",z\r\n');
    expect(rows).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["line1\nline2", "z"]]);
  });

  it("strips a BOM and skips blank lines", () => {
    expect(parseCsv("﻿a,b\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("phone handling", () => {
  it("normalises Indian number formats to 10 digits", () => {
    for (const raw of ["+91 98200 12345", "919820012345", "09820012345", "98200-12345"]) {
      expect(nationalNumber(raw)).toBe("9820012345");
    }
    expect(nationalNumber("12345")).toBeNull();
    expect(nationalNumber(undefined)).toBeNull();
  });

  it("tells mobiles from STD-coded landlines", () => {
    expect(phoneKind("+91 98200 12345")).toBe("mobile");
    expect(phoneKind("080 2345 6789")).toBe("landline");
    expect(phoneKind("+91 80 2345 6789")).toBe("landline");
    expect(phoneKind("+91 80123 45678")).toBe("mobile");
    expect(phoneKind("044 2345 6789")).toBe("landline");
    expect(phoneKind("")).toBeNull();
  });
});

describe("findCityId", () => {
  it("matches names case-insensitively and maps Bangalore to Bengaluru", () => {
    expect(findCityId(cities, "Bangalore")).toBe("c-blr");
    expect(findCityId(cities, " chennai ")).toBe("c-che");
    expect(findCityId(cities, "Atlantis")).toBeUndefined();
    expect(findCityId(cities, "")).toBeUndefined();
  });
});

describe("mapCsvRows", () => {
  const pilotHeader =
    "city,firm,status,score,sms_capable,phone,mobile,prefix_matched,portals,listings,localities,gmaps_name,gmaps_address,website,gmaps_place_id,portal_urls";

  it("selects only confident mobile rows from the agent finder's results CSV", () => {
    const csv = [
      pilotHeader,
      "Bengaluru,Olive Homes,confident,0.95,yes,+91 98200 12345,yes,yes,housing,3,Whitefield,Olive Homes Realty,Whitefield,https://o.in,pid1,https://h/1",
      "Bengaluru,Prestige Estates,confident,1.0,no,+91 80 2559 1080,landline,,99acres,2,,Prestige Estates Projects Limited,MG Road,,pid2,",
      "Bengaluru,Vishal,review,0.7,no,+91 99999 11111,yes,,housing,1,,Vishal Realty,HSR,,pid3,",
    ].join("\n");
    const result = mapCsvRows(parseCsv(csv), options);
    if ("error" in result) throw new Error(result.error);

    expect(result.rows.map((r) => r.defaultSelected)).toEqual([true, false, false]);
    const olive = result.rows[0].contact;
    expect(olive).toMatchObject({
      name: "Olive Homes Realty",
      phone: "9820012345",
      cityId: "c-blr",
      googlePlaceId: "pid1",
      businessCategory: "real_estate_agent",
      source: "scrape",
      consentState: "none",
      tags: ["portal-agent"],
    });
    expect(olive.notes).toContain("Portal name: Olive Homes");
    expect(olive.notes).toContain("Advertises on housing");
  });

  it("selects any mobile in a plain contact sheet, and flags an unknown city", () => {
    const result = mapCsvRows(parseCsv("name,phone,city\nAcme,98200 12345,Atlantis\nNo Phone,,Chennai"), options);
    if ("error" in result) throw new Error(result.error);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].defaultSelected).toBe(true);
    expect(result.rows[0].cityMatched).toBe(false);
    expect(result.rows[0].contact.notes).toContain("City not matched: Atlantis");
    expect(result.rows[1].defaultSelected).toBe(false);
  });

  it("never marks consent and never selects a landline", () => {
    const result = mapCsvRows(parseCsv("name,phone\nA,080 2345 6789"), options);
    if ("error" in result) throw new Error(result.error);
    expect(result.rows[0].defaultSelected).toBe(false);
    expect(result.rows[0].contact.consentState).toBe("none");
  });

  it("rejects a file without name and phone columns, or without data", () => {
    expect(mapCsvRows(parseCsv("foo,bar\n1,2"), options)).toHaveProperty("error");
    expect(mapCsvRows(parseCsv("name,phone"), options)).toHaveProperty("error");
  });
});
