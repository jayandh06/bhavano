"use server";

import { revalidatePath } from "next/cache";
import type { AreaOverviewContent, AreaOverviewStatus, CityOverviewDto } from "@bhavano/types/areaOverview";
import { requireAdmin } from "@/lib/requireAdmin";
import { saveCityOverview, setCityOverviewStatus } from "@/lib/bff";

export type CityOverviewResult = { success: true; overview: CityOverviewDto } | { success: false; error: string };

export async function saveCityOverviewAction(cityId: string, content: AreaOverviewContent): Promise<CityOverviewResult> {
  const { accessToken } = await requireAdmin();
  try {
    const overview = await saveCityOverview(accessToken, cityId, content);
    revalidatePath("/city-overviews");
    return { success: true, overview };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save" };
  }
}

export async function setCityOverviewStatusAction(
  cityId: string,
  status: AreaOverviewStatus,
  checklistConfirmed: boolean,
): Promise<CityOverviewResult> {
  const { accessToken } = await requireAdmin();
  try {
    const overview = await setCityOverviewStatus(accessToken, cityId, status, checklistConfirmed);
    revalidatePath("/city-overviews");
    return { success: true, overview };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to change status" };
  }
}
