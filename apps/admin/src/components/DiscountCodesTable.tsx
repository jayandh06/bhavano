"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DiscountCodeDto } from "@bhavano/types";
import { setDiscountCodeActiveAction } from "@/app/actions/discount-codes";
import { formatDateTime } from "@/lib/formatDateTime";

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

export function DiscountCodesTable({ items }: { items: DiscountCodeDto[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function onToggle(id: string, active: boolean) {
    setPendingId(id);
    await setDiscountCodeActiveAction(id, !active);
    setPendingId(null);
    router.refresh();
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
            {["Code", "Discount", "Redemptions", "Expires", "Created", "Status", ""].map((h) => (
              <th key={h} style={thStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...tdStyle, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>{c.code}</td>
              <td style={tdStyle}>{c.discountPercent}%</td>
              <td style={tdStyle}>
                {c.redemptionCount}
                {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                {c.maxRedemptionsPerUser > 1 && (
                  <span style={{ color: "var(--muted)" }}> · {c.maxRedemptionsPerUser}/user</span>
                )}
              </td>
              <td style={tdStyle}>{c.expiresAt ? formatDateTime(c.expiresAt) : dash}</td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(c.createdAt)}</td>
              <td style={tdStyle}>
                <span style={{ color: c.active ? "var(--green)" : "var(--danger)", fontWeight: 700 }}>
                  {c.active ? "Active" : "Inactive"}
                </span>
              </td>
              <td style={tdStyle}>
                <button
                  onClick={() => onToggle(c.id, c.active)}
                  disabled={pendingId === c.id}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "5px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-soft)",
                    cursor: "pointer",
                    opacity: pendingId === c.id ? 0.6 : 1,
                  }}
                >
                  {c.active ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
