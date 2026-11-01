import { NextResponse } from "next/server";

/**
 * Receives LayoutShiftReporter's report of a page with bad layout shift and writes it to the server log as one `[cls]` JSON line
 * (the log goes to Loki). No database: this is a short diagnostic to find what shifts for real visitors.
 *
 * Under `/api`, so middleware skips it and no page view is logged for it. Everything is clamped, because the body is client-supplied.
 * Always 204.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const b = (await request.json()) as { cls?: unknown; path?: unknown; width?: unknown; shifts?: unknown };
    const shifts = Array.isArray(b.shifts)
      ? b.shifts.slice(0, 5).map((s: { value?: unknown; at?: unknown; sources?: unknown }) => ({
          value: Number(s.value) || 0,
          at: Number(s.at) || 0,
          sources: Array.isArray(s.sources) ? s.sources.slice(0, 2).map((x) => String(x).slice(0, 120)) : [],
        }))
      : [];
    console.warn(
      "[cls] " +
        JSON.stringify({
          cls: Number(b.cls) || 0,
          path: typeof b.path === "string" ? b.path.slice(0, 200) : "",
          width: Number(b.width) || 0,
          ua: (request.headers.get("user-agent") ?? "").slice(0, 160),
          shifts,
        }),
    );
  } catch {
    // Malformed report: ignore.
  }
  return new NextResponse(null, { status: 204 });
}
