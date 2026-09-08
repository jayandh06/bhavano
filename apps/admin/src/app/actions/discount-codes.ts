"use server";

import { revalidatePath } from "next/cache";
import type { CreateDiscountCodeInput } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { createDiscountCode, setDiscountCodeActive } from "@/lib/bff";

export type ActionResult = { success: true } | { success: false; error: string };

export async function createDiscountCodeAction(input: CreateDiscountCodeInput): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await createDiscountCode(accessToken, input);
    revalidatePath("/discount-codes");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create discount code" };
  }
}

export async function setDiscountCodeActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await setDiscountCodeActive(accessToken, id, active);
    revalidatePath("/discount-codes");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update discount code" };
  }
}
