"use server";

import { headers } from "next/headers";
import type { ClientErrorInput } from "@bhavano/types";
import { reportClientError } from "@/lib/bff";

/** Deliberately NOT gated by requireAdmin(), unlike every other action in this directory — a
 * crash can happen on the admin login page itself, before any session exists, and the BFF's own
 * `POST /client-errors` is public/unauthenticated for exactly that reason. See
 * docs/plans/client-error-reporting-loki-grafana.md. */
async function clientIp(): Promise<string | undefined> {
  const forwarded = (await headers()).get("x-forwarded-for");
  if (!forwarded) return undefined;
  const hops = forwarded.split(",").map((v) => v.trim()).filter(Boolean);
  return hops[hops.length - 1];
}

export async function reportClientErrorAction(input: Omit<ClientErrorInput, "app" | "ip">): Promise<void> {
  await reportClientError({ ...input, app: "admin", ip: await clientIp() });
}
