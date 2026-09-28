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

  it("resolves the pg/furniture/interiors tabs to their own category, with web's transaction mapping", () => {
    const pg = deriveHomeRequirementCriteria({ category: "pg", bedrooms: [] }).criteria;
    expect(pg.category).toBe("pg");
    expect(pg.transactionType).toBe("rent");

    const interiors = deriveHomeRequirementCriteria({ category: "interiors", bedrooms: [] }).criteria;
    expect(interiors.category).toBe("interiors");
    expect(interiors.transactionType).toBe("sell");

    // Furniture can be bought or rented — the refinement questions ask which.
    const furniture = deriveHomeRequirementCriteria({ category: "furniture", bedrooms: [] }).criteria;
    expect(furniture.category).toBe("furniture");
    expect(furniture.transactionType).toBeUndefined();
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

  it("keeps the whole BHK set, with the smallest as the legacy single count", () => {
    const { criteria } = deriveHomeRequirementCriteria({ category: "all", bedrooms: [3, 2, 4] });
    expect(criteria.bedroomOptions).toEqual([2, 3, 4]);
    expect(criteria.bedrooms).toBe(2);

    const empty = deriveHomeRequirementCriteria({ category: "all", bedrooms: [] }).criteria;
    expect(empty.bedroomOptions).toEqual([]);
    expect(empty.bedrooms).toBeUndefined();
  });

  it("drops the BHK set for a category without bedrooms", () => {
    const { criteria } = deriveHomeRequirementCriteria({ category: "pg", bedrooms: [2] });
    expect(criteria.bedroomOptions).toEqual([]);
  });

  it("keeps up to five areas, and treats more as anywhere in the city", () => {
    const few = deriveHomeRequirementCriteria({ category: "all", areaIds: ["a1", "a2"], bedrooms: [] }).criteria;
    expect(few.areaIds).toEqual(["a1", "a2"]);

    const many = deriveHomeRequirementCriteria({
      category: "all",
      areaIds: ["a1", "a2", "a3", "a4", "a5", "a6"],
      bedrooms: [],
    }).criteria;
    expect(many.areaIds).toEqual([]);
  });

  it("carries the tab's own facet and furnishing as attributes", () => {
    const pg = deriveHomeRequirementCriteria({ category: "pg", sharingType: "double", bedrooms: [] }).criteria;
    expect(pg.attributes).toEqual({ sharingType: ["double"] });

    const home = deriveHomeRequirementCriteria({
      category: "rentLease",
      propertyType: "apartment",
      furnished: "semi",
      bedrooms: [],
    }).criteria;
    expect(home.attributes).toEqual({ furnished: ["semi"] });
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
