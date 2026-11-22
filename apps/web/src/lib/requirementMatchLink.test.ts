import { describe, expect, it } from "vitest";
import { requirementMatchHref, requirementMatchText } from "./requirementMatchLink";

describe("requirementMatchHref", () => {
  it("narrows the Requirements tab to the ad's city, area, type and transaction", () => {
    expect(requirementMatchHref({ cityName: "Bengaluru", area: "Konankunte", category: "apartment", transactionType: "rent" })).toBe(
      "/requirements/bengaluru?areas=konankunte&type=apartment&txn=rent",
    );
  });
  it("slugs multi-word names the way the feed page does", () => {
    expect(requirementMatchHref({ cityName: "Navi Mumbai", area: "Koper Khairane", category: "house", transactionType: "sell" })).toBe(
      "/requirements/navi-mumbai?areas=koper-khairane&type=house&txn=sell",
    );
  });
});

describe("requirementMatchText", () => {
  it("handles one and many", () => {
    expect(requirementMatchText(1)).toBe("1 person is looking for this");
    expect(requirementMatchText(3)).toBe("3 people are looking for this");
  });
});
