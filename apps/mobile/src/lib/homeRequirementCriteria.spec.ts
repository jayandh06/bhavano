import { deriveHomeRequirementCriteria } from "./homeRequirementCriteria";

describe("deriveHomeRequirementCriteria", () => {
  it("leaves category/transactionType undefined for the All tab", () => {
    const { criteria, label } = deriveHomeRequirementCriteria({
      category: "all",
      bedrooms: [],
    });
    expect(criteria.category).toBeUndefined();
    expect(criteria.transactionType).toBeUndefined();
    expect(label).toBe("All");
  });

  it("resolves the pg/furniture/interiors tabs directly to their own category, no transactionType", () => {
    for (const category of ["pg", "furniture", "interiors"] as const) {
      const { criteria } = deriveHomeRequirementCriteria({ category, bedrooms: [] });
      expect(criteria.category).toBe(category);
      expect(criteria.transactionType).toBeUndefined();
    }
  });

  it("resolves Buy to transactionType sell, using propertyType as the category when chosen", () => {
    const withoutPropertyType = deriveHomeRequirementCriteria({ category: "buy", bedrooms: [] });
    expect(withoutPropertyType.criteria.transactionType).toBe("sell");
    expect(withoutPropertyType.criteria.category).toBeUndefined();
    expect(withoutPropertyType.label).toBe("Buy");

    const withPropertyType = deriveHomeRequirementCriteria({
      category: "buy",
      propertyType: "apartment",
      bedrooms: [],
    });
    expect(withPropertyType.criteria.category).toBe("apartment");
    expect(withPropertyType.criteria.transactionType).toBe("sell");
    expect(withPropertyType.label).toBe("Apartment");
  });

  it("resolves Rent & Lease to transactionType rent", () => {
    const { criteria, label } = deriveHomeRequirementCriteria({
      category: "rentLease",
      propertyType: "house",
      bedrooms: [],
    });
    expect(criteria.transactionType).toBe("rent");
    expect(criteria.category).toBe("house");
    expect(label).toBe("House");
  });

  it("appends the city name to the label when a city is selected", () => {
    const { label } = deriveHomeRequirementCriteria({
      category: "pg",
      cityName: "Bengaluru",
      bedrooms: [],
    });
    expect(label).toBe("PG in Bengaluru");
  });

  it("omits the city from the label when browsing all cities", () => {
    const { label } = deriveHomeRequirementCriteria({ category: "pg", bedrooms: [] });
    expect(label).toBe("PG");
  });

  it("takes the smallest bedroom count from a multi-select set, and omits it entirely when empty", () => {
    expect(deriveHomeRequirementCriteria({ category: "all", bedrooms: [3, 2, 4] }).criteria.bedrooms).toBe(2);
    expect(deriveHomeRequirementCriteria({ category: "all", bedrooms: [] }).criteria.bedrooms).toBeUndefined();
  });

  it("passes cityId, minPrice, and maxPrice straight through", () => {
    const { criteria } = deriveHomeRequirementCriteria({
      category: "all",
      cityId: "city1",
      minPrice: 5000,
      maxPrice: 20000,
      bedrooms: [],
    });
    expect(criteria.cityId).toBe("city1");
    expect(criteria.minPrice).toBe(5000);
    expect(criteria.maxPrice).toBe(20000);
  });

  it("tags landingPath so an admin reading this later can tell it came from the app", () => {
    const { criteria } = deriveHomeRequirementCriteria({ category: "all", bedrooms: [] });
    expect(criteria.landingPath).toBe("mobile-app:home");
  });
});
