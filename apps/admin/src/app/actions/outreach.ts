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
  createListingFromContact,
  importOutreachContacts,
  optOutContact,
  runCampaign,
  sendClaimVerification,
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

export type SendClaimVerificationBulkResult = {
  contactId: string;
  name: string;
  sent: boolean;
  channels: string[];
  reason?: string;
};

/** Multi-select follow-up for contacts a scraping/upload run didn't send claim-verification for
 * at the time (bulk_upload_listings.py's --send-claim-verification flag is optional) — sends
 * each selected contact through the same POST .../send-claim-verification the flag itself calls,
 * sequentially rather than in parallel so a batch doesn't burst MSG91/SMTP all at once. Every
 * contact's own eligibility (unclaimed linked listing, not opted out, city/area present,
 * per-channel suppression) is still enforced server-side in OutreachService.sendClaimVerification
 * — this loop is purely "call it once per selection," not a bypass of any of that. */
export async function sendClaimVerificationBulkAction(
  contacts: { id: string; name: string }[],
): Promise<SendClaimVerificationBulkResult[]> {
  const { accessToken } = await requireAdmin();
  const results: SendClaimVerificationBulkResult[] = [];
  for (const contact of contacts) {
    try {
      const result = await sendClaimVerification(accessToken, contact.id);
      results.push({ contactId: contact.id, name: contact.name, ...result });
    } catch (error) {
      results.push({
        contactId: contact.id,
        name: contact.name,
        sent: false,
        channels: [],
        reason: error instanceof Error ? error.message : "Request failed",
      });
    }
  }
  revalidatePath("/outreach/contacts");
  return results;
}

export type CreateListingBulkResult = { contactId: string; name: string; ok: true; listingId: string } | {
  contactId: string;
  name: string;
  ok: false;
  error: string;
};

/** Same sequential-not-parallel reasoning as sendClaimVerificationBulkAction — a batch shouldn't
 * burst photo uploads to R2 all at once. See OutreachService.createListingFromContact for what
 * actually gets created: real data where scraping found it (name/city/area/lat-lng/photos), a
 * default sharing/seat type otherwise, on the premise that the business claiming it later fills
 * in the rest. */
export async function createListingFromContactBulkAction(
  contacts: { id: string; name: string }[],
): Promise<CreateListingBulkResult[]> {
  const { accessToken } = await requireAdmin();
  const results: CreateListingBulkResult[] = [];
  for (const contact of contacts) {
    try {
      const listing = await createListingFromContact(accessToken, contact.id);
      results.push({ contactId: contact.id, name: contact.name, ok: true, listingId: listing.id });
    } catch (error) {
      results.push({
        contactId: contact.id,
        name: contact.name,
        ok: false,
        error: error instanceof Error ? error.message : "Request failed",
      });
    }
  }
  revalidatePath("/outreach/contacts");
  return results;
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
