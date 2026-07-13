export type ListingCategory = "house" | "apartment" | "pg" | "storage" | "furniture";

export type TransactionType = "buy" | "sell" | "rent" | "lease";

export type ListingStatus = "active" | "sold" | "rented" | "deactivated";

export type ListingCondition = "new" | "used";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Listing {
  id: string;
  category: ListingCategory;
  transactionType: TransactionType;
  price: number;
  location: GeoPoint;
  ownerId: string;
  status: ListingStatus;
  condition?: ListingCondition;
  relatedListingId?: string;
  attributes: Record<string, unknown>;
  createdAt: string;
}
