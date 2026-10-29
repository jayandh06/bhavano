import { describe, expect, it } from "vitest";
import { websiteUrl } from "@bhavano/types/websiteUrl";

describe("websiteUrl", () => {
  it("links real web addresses, adding https:// to a bare domain", () => {
    expect(websiteUrl("yourbusiness.com")).toBe("https://yourbusiness.com");
    expect(websiteUrl(" www.pgstay.in/rooms?x=1 ")).toBe("https://www.pgstay.in/rooms?x=1");
    expect(websiteUrl("http://example.co.in")).toBe("http://example.co.in");
    expect(websiteUrl("https://sub.example.com:8080/a#b")).toBe("https://sub.example.com:8080/a#b");
  });

  it("refuses text that is not a web address, including the pasted description that was reported as a broken URL", () => {
    expect(websiteUrl("https://Kalyani express Highway khardha dopere.Godown rent ..Best for any Industry. Phone number 9330966060")).toBeNull();
    expect(websiteUrl("Kalyani express Highway")).toBeNull();
    expect(websiteUrl("call 9330966060")).toBeNull();
    expect(websiteUrl("")).toBeNull();
    expect(websiteUrl(undefined)).toBeNull();
  });

  it("never links a script or data address", () => {
    expect(websiteUrl("javascript:alert(1)")).toBeNull();
    expect(websiteUrl("data:text/html;base64,AAAA")).toBeNull();
    expect(websiteUrl("mailto:a@b.com")).toBeNull();
    expect(websiteUrl("tel:9330966060")).toBeNull();
  });
});
