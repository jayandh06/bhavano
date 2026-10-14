import { androidRedirect } from "@/lib/appStoreRedirect";

export function GET() {
  return androidRedirect();
}
