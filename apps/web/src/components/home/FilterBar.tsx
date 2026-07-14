const FILTERS = ["Price", "Property type", "Bedrooms", "Furnishing"];

export function FilterBar({ resultsCount, cityName }: { resultsCount: number; cityName: string }) {
  return (
    <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "14px 32px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {FILTERS.map((label) => (
          <button
            key={label}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-soft)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {label} <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
          </button>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
          {resultsCount} results near {cityName}
        </div>
      </div>
    </div>
  );
}
