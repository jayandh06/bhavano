"use server";

import type { CampaignPreviewDto } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { previewCampaign } from "@/lib/bff";

export type PreviewResult =
  | { success: true; preview: CampaignPreviewDto }
  | { success: false; error: string };

/** Read-only, so it lives apart from the mutating outreach actions and never revalidates a path. */
export async function previewCampaignAction(id: string): Promise<PreviewResult> {
  const { accessToken } = await requireAdmin();
  try {
    return { success: true, preview: await previewCampaign(accessToken, id) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Preview failed" };
  }
}
