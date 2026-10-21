import { describe, expect, it } from "vitest";
import { bulkImportChoice, bulkImportQueryValue } from "./bulkImportFilter";

describe("bulkImportChoice", () => {
  it("hides bulk imports unless the admin chose otherwise", () => {
    expect(bulkImportChoice(undefined)).toBe("exclude");
    expect(bulkImportChoice("")).toBe("exclude");
    expect(bulkImportChoice("exclude")).toBe("exclude");
    expect(bulkImportChoice("garbage")).toBe("exclude");
  });

  it("honours show-all and only-imports", () => {
    expect(bulkImportChoice("all")).toBe("all");
    expect(bulkImportChoice("only")).toBe("only");
  });
});

describe("bulkImportQueryValue", () => {
  it("sends no filter for show-all, and the filter otherwise", () => {
    expect(bulkImportQueryValue("all")).toBeUndefined();
    expect(bulkImportQueryValue("exclude")).toBe("exclude");
    expect(bulkImportQueryValue("only")).toBe("only");
  });
});
