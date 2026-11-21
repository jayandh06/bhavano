import { describe, expect, it } from "vitest";
import {
  leavingActiveNotice,
  ownerStatusLabel,
  publicStatusLabel,
  statusOptionsFor,
} from "@bhavano/types/listingStatusInfo";

const values = (t: Parameters<typeof statusOptionsFor>[0], c: Parameters<typeof statusOptionsFor>[1]) =>
  statusOptionsFor(t, c).map((o) => o.value);

describe("statusOptionsFor", () => {
  it("offers Sold, not Rented, on a sale ad", () => {
    expect(values("sell", "active")).toEqual(["active", "sold", "deactivated"]);
  });
  it("offers Rented, not Sold, on a rent or lease ad", () => {
    expect(values("rent", "active")).toEqual(["active", "rented", "deactivated"]);
    expect(values("lease", "active")).toEqual(["active", "rented", "deactivated"]);
  });
  it("keeps the current value even when it is the other closed status", () => {
    expect(values("sell", "rented")).toEqual(["active", "sold", "rented", "deactivated"]);
  });
  it("never claims to notify people who showed interest", () => {
    const text = statusOptionsFor("sell", "active").flatMap((o) => [o.summary, ...o.effects]).join(" ").toLowerCase();
    expect(text).not.toMatch(/notif|told|inform/);
  });
});

describe("leavingActiveNotice", () => {
  it("says nothing when the ad stays or goes back to Active", () => {
    expect(leavingActiveNotice("active", "sold")).toBeNull();
    expect(leavingActiveNotice("sold", "sold")).toBeNull();
  });
  it("names the label the ad's page will show", () => {
    expect(leavingActiveNotice("deactivated", "active")).toContain("Deactivated");
    expect(leavingActiveNotice("sold", "active")).toContain("Sold");
  });
  it("warns that Featured days keep running", () => {
    expect(leavingActiveNotice("sold", "active", { featured: true })).toContain("Featured days keep running");
    expect(leavingActiveNotice("sold", "active", { featured: false })).not.toContain("Featured");
  });
});

describe("labels", () => {
  it("shows Paused to the owner but Deactivated on the ad's page", () => {
    expect(ownerStatusLabel("deactivated")).toBe("Paused");
    expect(publicStatusLabel("deactivated")).toBe("Deactivated");
  });
});
