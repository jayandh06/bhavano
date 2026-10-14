import type { NextRequest } from "next/server";
import { appRedirect } from "@/lib/appStoreRedirect";

export function GET(request: NextRequest) {
  return appRedirect(request);
}
