import { describe, expect, it } from "vitest";
import { parseDeliveryReport, summariseReport } from "./deliveryReport";

const HEADER =
  "Sent Time\tRequest ID\tMobile Number\tMessage\tSMS Count\tCredit Deduction\tCampaign Name\tTemplate Name\tCampaign Request ID\tRoute\tStatus\tFailure Reason\tLinks\tFirst Clicked At\tPause Code\tPause Reason\tRequest Logs\tUUID\tCRQID\tFlow ID\tDelivery Date\tDelivery Time\tCountry\tSender ID";

function line(requestId: string, status: string, reason: string, date: string, time: string) {
  return `2026-10-15 10:54:04\t${requestId}\t917892821XXX4\t\t1\t0.18\t-\tBhavano_URL_Campaign\t-\tTransactional\t${status}\t${reason}\t-\t-\t-\t-\t\t0\t0\ttpl\t${date}\t${time}\tIndia\tbhavno`;
}

describe("parseDeliveryReport", () => {
  it("reads a tab-separated MSG91 report by column name", () => {
    const text = [
      HEADER,
      line("366a6f6a325a425a38535a43", "Delivered", "-", "2026-10-15", "10:54:06"),
      line("366a6f6a32644776586a687a", "Failed", "Absent Subscriber", "2026-10-15", "13:34:11"),
      line("366a6f6a326263374a5a4c78", "Failed", "", "2026-10-15", "10:54:03"),
    ].join("\n");

    const result = parseDeliveryReport(text);
    if ("error" in result) throw new Error(result.error);

    expect(result.rows).toEqual([
      { requestId: "366a6f6a325a425a38535a43", status: "Delivered", failureReason: undefined, deliveredAt: "2026-10-15T10:54:06+05:30" },
      { requestId: "366a6f6a32644776586a687a", status: "Failed", failureReason: "Absent Subscriber", deliveredAt: "2026-10-15T13:34:11+05:30" },
      { requestId: "366a6f6a326263374a5a4c78", status: "Failed", failureReason: undefined, deliveredAt: "2026-10-15T10:54:03+05:30" },
    ]);
    expect(summariseReport(result.rows)).toBe("3 rows: 1 delivered, 2 failed");
  });

  it("also reads a comma-separated export", () => {
    const text = "Request ID,Status,Failure Reason,Delivery Date,Delivery Time\nabc,Delivered,-,2026-10-15,10:00:00";
    const result = parseDeliveryReport(text);
    if ("error" in result) throw new Error(result.error);
    expect(result.rows[0]).toMatchObject({ requestId: "abc", status: "Delivered", deliveredAt: "2026-10-15T10:00:00+05:30" });
  });

  it("treats a missing or malformed delivery time as unknown, not as an error", () => {
    const text = "Request ID\tStatus\nabc\tFailed";
    const result = parseDeliveryReport(text);
    if ("error" in result) throw new Error(result.error);
    expect(result.rows[0].deliveredAt).toBeUndefined();
  });

  it("rejects a file that is not a delivery report", () => {
    expect(parseDeliveryReport("name,phone\nA,9820012345")).toHaveProperty("error");
    expect(parseDeliveryReport("Request ID\tStatus")).toHaveProperty("error");
  });
});
