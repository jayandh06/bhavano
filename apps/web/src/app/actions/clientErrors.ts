"use server";

import { headers } from "next/headers";
import type { ClientErrorInput } from "@bhavano/types";
import { reportClientError } from "@/lib/bff";

/** Last hop of X-Forwarded-For, same trust reasoning as middleware.ts's own `clientIp` — Caddy
 * appends the connecting peer to whatever header arrived, so the leftmost value is
 * attacker-controlled and the rightmost is the address Caddy actually observed. Needed here (and
 * not left to the BFF's own `req.ip`) because this call reaches the BFF from the web container
 * itself, not the visitor's browser — see `ClientErrorInput.ip`'s own doc comment. */
async function clientIp(): Promise<string | undefined> {
  const forwarded = (await headers()).get("x-forwarded-for");
  if (!forwarded) return undefined;
  const hops = forwarded.split(",").map((v) => v.trim()).filter(Boolean);
  return hops[hops.length - 1];
}

/** Called from error.tsx/global-error.tsx — a UI crash reported to the BFF's Loki-backed logging.
 * See docs/plans/client-error-reporting-loki-grafana.md. */
export async function reportClientErrorAction(input: Omit<ClientErrorInput, "app" | "ip">): Promise<void> {
  await reportClientError({ ...input, app: "web", ip: await clientIp() });
}
