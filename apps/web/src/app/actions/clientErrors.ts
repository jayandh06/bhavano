"use server";

import { headers } from "next/headers";
import type { ClientErrorInput } from "@bhavano/types";
import { reportClientError } from "@/lib/bff";
import { visitorIp } from "@/lib/clientIp";

/** The visitor's IP (see `lib/clientIp`). Needed here (and not left to the BFF's own `req.ip`) because this call reaches
 * the BFF from the web container itself, not the visitor's browser — see `ClientErrorInput.ip`'s own doc comment. */
async function clientIp(): Promise<string | undefined> {
  return visitorIp((await headers()).get("x-forwarded-for"));
}

/** Called from error.tsx/global-error.tsx — a UI crash reported to the BFF's Loki-backed logging.
 * See docs/plans/client-error-reporting-loki-grafana.md. */
export async function reportClientErrorAction(input: Omit<ClientErrorInput, "app" | "ip">): Promise<void> {
  await reportClientError({ ...input, app: "web", ip: await clientIp() });
}
