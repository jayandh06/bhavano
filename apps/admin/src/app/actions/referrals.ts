"use server";

import { revalidatePath } from "next/cache";
import type { ReferralSettingsDto } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  approveReferral,
  freezeReferrals,
  reverseReferral,
  unfreezeReferrals,
  updateReferralSettings,
} from "@/lib/bff";
import type { ActionResult } from "./users";

function fail(error: unknown, fallback: string): ActionResult {
  return { success: false, error: error instanceof Error ? error.message : fallback };
}

function revalidateReferral(referralId: string, referrerId?: string) {
  revalidatePath("/referrals");
  revalidatePath(`/referrals/${referralId}`);
  if (referrerId) revalidatePath(`/users/${referrerId}`);
}

export async function updateReferralSettingsAction(input: ReferralSettingsDto): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateReferralSettings(accessToken, input);
    revalidatePath("/settings/referrals");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to update referral settings");
  }
}

export async function approveReferralAction(referralId: string, note?: string): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await approveReferral(accessToken, referralId, note || undefined);
    revalidateReferral(referralId);
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to approve referral");
  }
}

export async function reverseReferralAction(referralId: string, reason: string): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await reverseReferral(accessToken, referralId, reason);
    revalidateReferral(referralId);
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to reverse referral");
  }
}

export async function freezeReferralsAction(
  userId: string,
  reason: string,
  referralId?: string,
): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await freezeReferrals(accessToken, userId, reason);
    if (referralId) revalidateReferral(referralId, userId);
    else revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to freeze referrals");
  }
}

export async function unfreezeReferralsAction(
  userId: string,
  note?: string,
  referralId?: string,
): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await unfreezeReferrals(accessToken, userId, note || undefined);
    if (referralId) revalidateReferral(referralId, userId);
    else revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to unfreeze referrals");
  }
}
