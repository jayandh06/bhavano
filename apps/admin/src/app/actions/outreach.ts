"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateOutreachCampaignInput,
  ImportOutreachContactsInput,
  ImportOutreachContactsResult,
  UpdateOutreachCampaignInput,
} from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  createCampaign,
  importOutreachContacts,
  optOutContact,
  runCampaign,
  updateCampaign,
} from "@/lib/bff";
import type { ActionResult } from "./admin";

export async function optOutContactAction(contactId: string): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await optOutContact(accessToken, contactId, "opted out by admin");
    revalidatePath("/outreach/contacts");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to opt out contact" };
  }
}

export type ImportResult =
  | { success: true; result: ImportOutreachContactsResult }
  | { success: false; error: string };

export async function importContactsAction(input: ImportOutreachContactsInput): Promise<ImportResult> {
  const { accessToken } = await requireAdmin();
  try {
    const result = await importOutreachContacts(accessToken, input);
    revalidatePath("/outreach/contacts");
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Import failed" };
  }
}

export async function createCampaignAction(input: CreateOutreachCampaignInput): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await createCampaign(accessToken, input);
    revalidatePath("/outreach/campaigns");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create campaign" };
  }
}

export async function updateCampaignAction(
  id: string,
  input: UpdateOutreachCampaignInput,
): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateCampaign(accessToken, id, input);
    revalidatePath("/outreach/campaigns");
    revalidatePath(`/outreach/campaigns/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update campaign" };
  }
}

export type RunResult =
  | { success: true; sent: number; failed: number; skipped: number }
  | { success: false; error: string };

/** Fires the campaign immediately rather than waiting for the hourly tick. Still honours the
 * campaign's own dryRun flag — this is "run now", not "bypass the safety". */
export async function runCampaignAction(id: string): Promise<RunResult> {
  const { accessToken } = await requireAdmin();
  try {
    const result = await runCampaign(accessToken, id);
    revalidatePath("/outreach/campaigns");
    revalidatePath(`/outreach/campaigns/${id}`);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to run campaign" };
  }
}
