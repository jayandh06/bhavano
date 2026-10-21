import type { NextRequest } from "next/server";
import { androidRedirect } from "@/lib/appStoreRedirect";

export function GET(request: NextRequest) {
  return androidRedirect(request);
}
