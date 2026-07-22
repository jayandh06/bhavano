/** Both admin filter pages parse ~10 optional string params off Next's async `searchParams`
 * prop, which types each value as `string | string[] | undefined` (repeated query keys become
 * an array) — this narrows to the single-string case every filter field actually wants. */
export function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}
