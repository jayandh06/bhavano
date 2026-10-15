import { parseCsv } from "./outreachCsv";

export interface DeliveryReportRow {
  requestId: string;
  status: string;
  failureReason?: string;
  /** ISO timestamp of the delivery, India time. */
  deliveredAt?: string;
}

/** Reads an MSG91 SMS delivery report (the "Request ID / Status / Failure Reason / Delivery Date /
 * Delivery Time" export). MSG91's export is tab- or comma-separated depending on how it was
 * saved or pasted, so the delimiter is detected from the header line. Columns are found by name,
 * not position, because the report has about 25 of them and the order is MSG91's to change.
 * Mobile numbers in the report are masked (919019040XXX0), so rows can only be matched by request
 * id — that is all this returns. */
export function parseDeliveryReport(text: string): { rows: DeliveryReportRow[] } | { error: string } {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const records = parseCsv(text, delimiter);
  if (records.length < 2) return { error: "The file has no data rows." };

  const header = records[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idCol = col("request id");
  const statusCol = col("status");
  if (idCol < 0 || statusCol < 0) {
    return { error: 'This doesn\'t look like an MSG91 delivery report: it needs "Request ID" and "Status" columns.' };
  }
  const reasonCol = col("failure reason");
  const dateCol = col("delivery date");
  const timeCol = col("delivery time");
  const cell = (record: string[], i: number) => (i >= 0 ? (record[i] ?? "").trim() : "");

  const rows: DeliveryReportRow[] = [];
  for (const record of records.slice(1)) {
    const requestId = cell(record, idCol);
    const status = cell(record, statusCol);
    if (!requestId || !status) continue;
    const reason = cell(record, reasonCol);
    const date = cell(record, dateCol);
    const time = cell(record, timeCol);
    rows.push({
      requestId,
      status,
      failureReason: reason && reason !== "-" ? reason : undefined,
      deliveredAt: /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}:\d{2}$/.test(time) ? `${date}T${time}+05:30` : undefined,
    });
  }
  return rows.length > 0 ? { rows } : { error: "No rows with a request id and a status were found." };
}

export function summariseReport(rows: DeliveryReportRow[]): string {
  const count = (status: string) => rows.filter((r) => r.status.toLowerCase() === status).length;
  return `${rows.length} rows: ${count("delivered")} delivered, ${count("failed")} failed`;
}
