/** The Listing moderation "Bulk imports" filter. Bulk imports (listings created by the import tools under the system
 * Bulk Import account) are hidden by default so the queue shows what users and admins created; the select can show
 * everything or only the imports.
 *
 * The URL value is never empty on purpose: this screen's links drop empty params, so "show all" has to be a real value
 * ("all") or paging would silently bring the default (hide) back. An absent param means the default. */
export type BulkImportChoice = "exclude" | "all" | "only";

export function bulkImportChoice(raw: string | undefined): BulkImportChoice {
  return raw === "all" || raw === "only" ? raw : "exclude";
}

/** What the data query takes: "all" sends nothing, so the BFF applies no import filter. */
export function bulkImportQueryValue(choice: BulkImportChoice): "exclude" | "only" | undefined {
  return choice === "all" ? undefined : choice;
}
