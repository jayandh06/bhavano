"use server";

import type { ListingOwnerDto } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { searchUsers } from "@/lib/bff";

/** Backs UserPicker's live search. A read, not a mutation — swallows errors into an empty
 * result set rather than surfacing them, since a failed search just means "no matches yet"
 * from the picker's point of view. */
export async function searchUsersAction(q: string): Promise<ListingOwnerDto[]> {
  const { accessToken } = await requireAdmin();
  try {
    return await searchUsers(accessToken, q, 10);
  } catch {
    return [];
  }
}
