import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { restoreBasePath } from "@/lib/authRequest";

// The US build is served under /us and Next strips that before this runs; Auth.js needs it back (see restoreBasePath). A no-op for India.
export const GET = (req: NextRequest) => handlers.GET(restoreBasePath(req));
export const POST = (req: NextRequest) => handlers.POST(restoreBasePath(req));
