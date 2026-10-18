"use server";

import { revalidatePath } from "next/cache";
import type { AreaOverviewContent, AreaOverviewDto, AreaOverviewStatus } from "@bhavano/types/areaOverview";
import { requireAdmin } from "@/lib/requireAdmin";
import { saveAreaOverview, setAreaOverviewStatus } from "@/lib/bff";

export type AreaOverviewResult = { success: true; overview: AreaOverviewDto } | { success: false; error: string };

export async function saveAreaOverviewAction(areaId: string, content: AreaOverviewContent): Promise<AreaOverviewResult> {
  const { accessToken } = await requireAdmin();
  try {
    const overview = await saveAreaOverview(accessToken, areaId, content);
    revalidatePath("/area-overviews");
    return { success: true, overview };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save" };
  }
}

export async function setAreaOverviewStatusAction(
  areaId: string,
  status: AreaOverviewStatus,
  checklistConfirmed: boolean,
): Promise<AreaOverviewResult> {
  const { accessToken } = await requireAdmin();
  try {
    const overview = await setAreaOverviewStatus(accessToken, areaId, status, checklistConfirmed);
    revalidatePath("/area-overviews");
    return { success: true, overview };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to change status" };
  }
}
