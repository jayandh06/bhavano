// bffClient.ts imports ./trackingConsent, which imports react-native and
// expo-tracking-transparency — neither transformable nor meaningful outside a real app. Mocked
// here (before the import below) so this stays a pure-logic test with no native-module setup:
// the mock replaces the whole module, so react-native is never actually required.
jest.mock("./trackingConsent", () => ({ isTrackingAuthorized: () => null }));

import {
  BffError,
  createBoostOrder,
  createRequirement,
  fetchCities,
  fetchListings,
  friendlyErrorMessage,
  previewBoostPricing,
} from "./bffClient";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("fetchListings", () => {
  it("omits every filter that wasn't set", async () => {
    const fetchMock = mockFetchOnce({ items: [], total: 0, nextCursor: null });
    await fetchListings({ limit: 20 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toMatch(/\/listings\?limit=20$/);
  });

  it("joins multi-select areaIds/bedrooms with commas", async () => {
    const fetchMock = mockFetchOnce({ items: [], total: 0, nextCursor: null });
    await fetchListings({ areaIds: ["a1", "a2"], bedrooms: [2, 3] });
    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://x");
    expect(url.searchParams.get("areaIds")).toBe("a1,a2");
    expect(url.searchParams.get("bedrooms")).toBe("2,3");
  });

  it("drops empty areaIds/bedrooms arrays rather than sending an empty param", async () => {
    const fetchMock = mockFetchOnce({ items: [], total: 0, nextCursor: null });
    await fetchListings({ areaIds: [], bedrooms: [] });
    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://x");
    expect(url.searchParams.has("areaIds")).toBe(false);
    expect(url.searchParams.has("bedrooms")).toBe(false);
  });

  it("sends every real filter through unchanged", async () => {
    const fetchMock = mockFetchOnce({ items: [], total: 0, nextCursor: null });
    await fetchListings({
      homeCategory: "pg",
      cityId: "city1",
      q: "hostel",
      minPrice: 5000,
      maxPrice: 15000,
      furnished: "furnished",
      sort: "price_asc",
      cursor: "abc",
    });
    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://x");
    expect(url.searchParams.get("homeCategory")).toBe("pg");
    expect(url.searchParams.get("cityId")).toBe("city1");
    expect(url.searchParams.get("q")).toBe("hostel");
    expect(url.searchParams.get("minPrice")).toBe("5000");
    expect(url.searchParams.get("maxPrice")).toBe("15000");
    expect(url.searchParams.get("furnished")).toBe("furnished");
    expect(url.searchParams.get("sort")).toBe("price_asc");
    expect(url.searchParams.get("cursor")).toBe("abc");
  });

  it("attaches a Bearer token only when an access token is passed", async () => {
    const fetchMock = mockFetchOnce({ items: [], total: 0, nextCursor: null });
    await fetchListings({}, "token-123");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
  });

  it("throws BffError with the status and path on a non-ok response", async () => {
    mockFetchOnce({ message: "nope" }, false, 500);
    await expect(fetchListings({})).rejects.toMatchObject({ status: 500, path: expect.stringContaining("/listings") });
  });
});

describe("fetchCities", () => {
  it("only sets all=true when explicitly asked for every city", async () => {
    const fetchMock = mockFetchOnce([]);
    await fetchCities();
    expect(fetchMock.mock.calls[0][0]).not.toContain("all=true");

    await fetchCities(undefined, true);
    expect(fetchMock.mock.calls[1][0]).toContain("all=true");
  });

  it("passes a search term through as q", async () => {
    const fetchMock = mockFetchOnce([]);
    await fetchCities("bengal");
    expect(fetchMock.mock.calls[0][0]).toContain("q=bengal");
  });
});

describe("createBoostOrder", () => {
  it("posts listingId/boostDays/discountCode/includeInstantAlerts as JSON", async () => {
    const fetchMock = mockFetchOnce({ activated: false });
    await createBoostOrder("token", "listing1", 7, "BHAVANO-SEP", true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/payments/orders");
    expect(JSON.parse(init.body as string)).toEqual({
      listingId: "listing1",
      boostDays: 7,
      discountCode: "BHAVANO-SEP",
      includeInstantAlerts: true,
    });
  });
});

describe("previewBoostPricing", () => {
  it("sends the category always, the discount code only when given", async () => {
    const fetchMock = mockFetchOnce({});
    await previewBoostPricing("token", "apartment");
    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://x");
    expect(url.searchParams.get("category")).toBe("apartment");
    expect(url.searchParams.has("discountCode")).toBe(false);

    await previewBoostPricing("token", "apartment", "BHAVANO-SEP");
    const url2 = new URL(fetchMock.mock.calls[1][0] as string, "http://x");
    expect(url2.searchParams.get("discountCode")).toBe("BHAVANO-SEP");
  });
});

describe("createRequirement", () => {
  it("posts the input as JSON to /requirements", async () => {
    const fetchMock = mockFetchOnce({ id: "req1" });
    await createRequirement("token", { searchLabel: "PG in Bengaluru", cityId: "city1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/requirements");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ searchLabel: "PG in Bengaluru", cityId: "city1" });
  });
});

describe('friendlyErrorMessage', () => {
  it("returns the server's own message, not the BFF request wrapper", () => {
    const e = new BffError(400, '/auth/otp/link', JSON.stringify({ message: 'OTP has expired — request a new one', statusCode: 400 }));
    expect(friendlyErrorMessage(e, 'fallback')).toBe('OTP has expired — request a new one');
  });

  it('joins validation message arrays', () => {
    const e = new BffError(400, '/x', JSON.stringify({ message: ['a is required', 'b is invalid'] }));
    expect(friendlyErrorMessage(e, 'fallback')).toBe('a is required, b is invalid');
  });

  it('uses generic wording when the body is not JSON', () => {
    expect(friendlyErrorMessage(new BffError(502, '/x', '<html>bad gateway</html>'), 'f')).toMatch(/our side/);
    expect(friendlyErrorMessage(new BffError(400, '/x', ''), 'f')).toMatch(/try again/);
  });

  it('reports a network failure as a connection problem', () => {
    expect(friendlyErrorMessage(new TypeError('Network request failed'), 'f')).toMatch(/connection/);
  });

  it('falls back for anything else', () => {
    expect(friendlyErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
  });
});
