"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { HomeCategoryFilter, PropertyTypeFilter } from "@bhavano/types";
import { buildHomeUrl } from "@/lib/homeUrl";
import { HOME_TABS } from "@/lib/homeCategories";

export function CategoryTabs({
  active,
  activePropertyType,
}: {
  active: HomeCategoryFilter;
  activePropertyType?: PropertyTypeFilter;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = HOME_TABS.find((t) => t.value === active) ?? HOME_TABS[0];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {HOME_TABS.map((tab) => {
          const isActive = tab.value === active;
          return (
            <button
              key={tab.value}
              onClick={() =>
                router.push(buildHomeUrl(searchParams, { category: tab.value, propertyType: undefined }))
              }
              style={{
                background: isActive ? "var(--surface-alt)" : "transparent",
                color: isActive ? "var(--text)" : "var(--text-soft)",
                border: "none",
                borderBottom: `3px solid ${isActive ? "var(--gold)" : "transparent"}`,
                padding: "12px 18px 10px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab.propertyTypes.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 0" }}>
          <button
            onClick={() => router.push(buildHomeUrl(searchParams, { propertyType: undefined }))}
            style={{
              background: !activePropertyType ? "var(--surface-alt)" : "transparent",
              color: "var(--text-soft)",
              border: "1px solid var(--border)",
              borderRadius: 20,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            All types
          </button>
          {activeTab.propertyTypes.map((pt) => (
            <button
              key={pt.value}
              onClick={() => router.push(buildHomeUrl(searchParams, { propertyType: pt.value }))}
              style={{
                background: activePropertyType === pt.value ? "var(--surface-alt)" : "transparent",
                color: "var(--text-soft)",
                border: "1px solid var(--border)",
                borderRadius: 20,
                padding: "6px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {pt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
