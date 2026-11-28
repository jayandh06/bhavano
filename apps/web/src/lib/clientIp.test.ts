import { describe, expect, it } from "vitest";
import { visitorIp } from "./clientIp";

const INDIA = "13.205.0.54";

describe("the visitor's address", () => {
  it("is the last entry with one proxy in front, as in India", () => {
    expect(visitorIp("203.0.113.9", undefined)).toBe("203.0.113.9");
    expect(visitorIp("1.1.1.1, 203.0.113.9", "")).toBe("203.0.113.9");
  });

  it("is the one before our own forwarding server in the US", () => {
    expect(visitorIp(`198.51.100.7, ${INDIA}`, INDIA)).toBe("198.51.100.7");
    expect(visitorIp(`198.51.100.7, ${INDIA}, 10.0.0.2`, `${INDIA}, 10.0.0.2`)).toBe("198.51.100.7");
  });

  it("is not whatever a visitor wrote on the left", () => {
    expect(visitorIp(`9.9.9.9, 198.51.100.7, ${INDIA}`, INDIA)).toBe("198.51.100.7");
  });

  it("stays the direct caller when the request did not come through us", () => {
    expect(visitorIp("198.51.100.7", INDIA)).toBe("198.51.100.7");
  });

  it("falls back to the only address there is, and to nothing without a header", () => {
    expect(visitorIp(INDIA, INDIA)).toBe(INDIA);
    expect(visitorIp(null, INDIA)).toBeUndefined();
    expect(visitorIp("  ", INDIA)).toBeUndefined();
  });
});
